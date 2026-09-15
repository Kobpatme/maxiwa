/* Shared business rules for deposit/refund calculations. Browser + Node compatible. */
(function (root) {
  function normalize(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function parseMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
    if (value == null || value === '') return 0;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function isReturnYes(value) {
    return normalize(value) === 'yes';
  }

  function isCancelled(item) {
    return normalize(item && item.status) === 'cancel' || normalize(item && item.status_final) === 'cancel';
  }

  function hasRemovalDeposit(item) {
    return !isCancelled(item) && parseMoney(item && item.demolish) > 0;
  }

  function isRemovalRefunded(item) {
    return hasRemovalDeposit(item) && isReturnYes(item && item.demoReturn);
  }

  function isInstallationRefunded(item) {
    if (!item || isCancelled(item) || parseMoney(item.deposit) === 0) return false;
    return normalize(item.status) === 'done' || normalize(item.status_final) === 'done';
  }

  function isInstallationClosed(item) {
    if (!item || isCancelled(item)) return false;
    const status = normalize(item.status);
    const finalStatus = normalize(item.status_final);
    if (status === 'done' || finalStatus === 'done') return true;

    const isClosingStep = status === 'clo' || finalStatus === 'clo';
    const inspectedByBuilding = normalize(item.inspected_by) === 'building dept';
    return isClosingStep && (inspectedByBuilding || Boolean(item.pdf_user_final));
  }

  function isOffServicePendingItem(item) {
    if (!hasRemovalDeposit(item) || !isInstallationClosed(item) || isRemovalRefunded(item)) return false;
    const pendingStatus = normalize(item && item.off_service_status) === 'pending';
    return pendingStatus || Boolean(item && (item.off_service_requested || item.service_cancel_date));
  }

  function isOnServiceItem(item) {
    return hasRemovalDeposit(item) && isInstallationClosed(item)
      && !isRemovalRefunded(item) && !isOffServicePendingItem(item);
  }

  function isPreServiceItem(item) {
    return hasRemovalDeposit(item) && !isRemovalRefunded(item) && !isInstallationClosed(item);
  }

  function isFullyCompleted(item) {
    return normalize(item && item.status) === 'done'
      && !isOnServiceItem(item) && !isOffServicePendingItem(item);
  }

  function sortCompletedLast(items, withinGroupComparator) {
    return [...(items || [])].sort((a, b) => {
      // Active work first, then On Service, and fully completed work last.
      const priority = item => isFullyCompleted(item) ? 2 : isOnServiceItem(item) ? 1 : 0;
      const workflowOrder = priority(a) - priority(b);
      if (workflowOrder !== 0) return workflowOrder;
      return typeof withinGroupComparator === 'function' ? withinGroupComparator(a, b) : 0;
    });
  }

  function getRemovalDepositMetrics(items) {
    return (items || []).reduce((metrics, item) => {
      if (!hasRemovalDeposit(item)) return metrics;
      const amount = parseMoney(item.demolish);
      metrics.totalAmount += amount;
      metrics.totalCount += 1;
      if (isRemovalRefunded(item)) {
        metrics.refundedAmount += amount;
        metrics.refundedCount += 1;
      } else {
        metrics.outstandingAmount += amount;
        metrics.outstandingCount += 1;
      }
      if (isOffServicePendingItem(item)) {
        metrics.offServicePendingAmount += amount;
        metrics.offServicePendingCount += 1;
      } else if (isOnServiceItem(item)) {
        metrics.onServiceAmount += amount;
        metrics.onServiceCount += 1;
      } else if (isPreServiceItem(item)) {
        metrics.preServiceAmount += amount;
        metrics.preServiceCount += 1;
      }
      return metrics;
    }, {
      totalAmount: 0, totalCount: 0,
      refundedAmount: 0, refundedCount: 0,
      outstandingAmount: 0, outstandingCount: 0,
      onServiceAmount: 0, onServiceCount: 0,
      offServicePendingAmount: 0, offServicePendingCount: 0,
      preServiceAmount: 0, preServiceCount: 0
    });
  }

  function getInstallationDepositMetrics(items) {
    return (items || []).reduce((metrics, item) => {
      if (isCancelled(item)) return metrics;
      const amount = parseMoney(item && item.deposit);
      if (amount === 0) return metrics;
      metrics.totalAmount += amount;
      metrics.totalCount += 1;
      if (isInstallationRefunded(item)) {
        metrics.refundedAmount += amount;
        metrics.refundedCount += 1;
      } else {
        metrics.outstandingAmount += amount;
        metrics.outstandingCount += 1;
      }
      return metrics;
    }, {
      totalAmount: 0, totalCount: 0,
      refundedAmount: 0, refundedCount: 0,
      outstandingAmount: 0, outstandingCount: 0
    });
  }

  function getNonRefundableCostMetrics(items) {
    return (items || []).reduce((metrics, item) => {
      if (isCancelled(item)) return metrics;
      const feeAmount = parseMoney(item && item.fee);
      const otherAmount = parseMoney(item && item.other);
      if (feeAmount === 0 && otherAmount === 0) return metrics;
      metrics.feeAmount += feeAmount;
      metrics.otherAmount += otherAmount;
      metrics.totalAmount += feeAmount + otherAmount;
      metrics.affectedCount += 1;
      if (otherAmount > 0 && !String(item && item.other_desc || '').trim()) {
        metrics.missingOtherDescriptionCount += 1;
      }
      return metrics;
    }, {
      feeAmount: 0,
      otherAmount: 0,
      totalAmount: 0,
      affectedCount: 0,
      missingOtherDescriptionCount: 0
    });
  }

  function getSidebarFinancialMetrics(items) {
    const activeItems = (items || []).filter(item => !isCancelled(item));
    const installationMetrics = getInstallationDepositMetrics(activeItems);
    const removalMetrics = getRemovalDepositMetrics(activeItems);

    const totalPaymentAmount = activeItems.reduce((sum, item) => {
      return sum
        + parseMoney(item && item.deposit)
        + parseMoney(item && item.demolish)
        + parseMoney(item && item.fee)
        + parseMoney(item && item.other);
    }, 0);

    return {
      totalPaymentAmount,
      installationOutstandingAmount: installationMetrics.outstandingAmount,
      removalOutstandingAmount: removalMetrics.outstandingAmount,
      totalOutstandingAmount: installationMetrics.outstandingAmount + removalMetrics.outstandingAmount
    };
  }

  function getListPageKpiMetrics(items, options) {
    const rows = Array.isArray(items) ? items : [];
    const config = options || {};
    const statusResolver = typeof config.statusResolver === 'function'
      ? config.statusResolver
      : item => normalize(item && (item.workflowKey || item.status)) || 'new';
    const closedWorkflowKeys = new Set(['done', 'on_service', 'cancel']);
    const completedWorkflowKeys = new Set(['done', 'on_service']);
    const installationMetrics = getInstallationDepositMetrics(rows);
    const removalMetrics = getRemovalDepositMetrics(rows);
    const costMetrics = getNonRefundableCostMetrics(rows);

    return {
      totalCount: rows.length,
      activeWorkCount: rows.filter(item => !closedWorkflowKeys.has(normalize(statusResolver(item)))).length,
      completedCount: rows.filter(item => completedWorkflowKeys.has(normalize(statusResolver(item)))).length,
      nonRefundableCostAmount: costMetrics.totalAmount,
      feeAmount: costMetrics.feeAmount,
      otherAmount: costMetrics.otherAmount,
      installationDepositAmount: installationMetrics.totalAmount,
      onServiceRemovalAmount: removalMetrics.onServiceAmount
    };
  }

  function parseDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    if (typeof value.toDate === 'function') {
      const converted = value.toDate();
      return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    }
    if (typeof value.seconds === 'number') {
      const converted = new Date(value.seconds * 1000);
      return Number.isNaN(converted.getTime()) ? null : converted;
    }

    const text = String(value).trim();
    const thaiMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (thaiMatch) {
      let year = Number(thaiMatch[3]);
      if (year > 2400) year -= 543;
      const converted = new Date(
        year, Number(thaiMatch[2]) - 1, Number(thaiMatch[1]),
        Number(thaiMatch[4] || 0), Number(thaiMatch[5] || 0), Number(thaiMatch[6] || 0)
      );
      return Number.isNaN(converted.getTime()) ? null : converted;
    }

    const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateMatch) {
      const converted = new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]));
      return Number.isNaN(converted.getTime()) ? null : converted;
    }

    const converted = new Date(text);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  function dayStart(value) {
    const date = parseDateValue(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function daysBetween(from, to) {
    const start = dayStart(from);
    const end = dayStart(to);
    if (!start || !end) return null;
    return Math.max(0, Math.floor((end - start) / 86400000));
  }

  function getLastActivityDate(item) {
    const candidates = [item && item.updatedAt, item && item.createdAt, item && item.dateReq];
    (item && Array.isArray(item.log) ? item.log : []).forEach(entry => {
      candidates.push(entry && (entry.time || entry.createdAt || entry.timestamp));
    });
    return candidates
      .map(parseDateValue)
      .filter(Boolean)
      .sort((a, b) => b - a)[0] || null;
  }

  function getOutstandingAmount(item) {
    if (!item || isCancelled(item)) return 0;
    const installation = isInstallationRefunded(item) ? 0 : parseMoney(item.deposit);
    const removal = isReturnYes(item.demoReturn) ? 0 : parseMoney(item.demolish);
    return installation + removal;
  }

  function getMissingDocumentLabels(item, workflowKey) {
    const missing = [];
    const afterPayment = ['att', 'tl_wait', 'tl_process', 'ret', 'clo', 'refund_process', 'done', 'on_service'];
    if (afterPayment.includes(workflowKey) && !item.pdf_payment) missing.push('หลักฐานการจ่าย');

    const requiresTlEvidence = ['ret', 'clo', 'refund_process', 'done', 'on_service'].includes(workflowKey)
      && normalize(item.inspected_by) !== 'building dept';
    if (requiresTlEvidence && !item.pdf_tl_work) missing.push('หลักฐานงาน TL');
    if (workflowKey === 'off_service_pending' && !item.pdf_demo_off) missing.push('หลักฐาน Off Service');
    if (workflowKey === 'clo' && !item.pdf_user_final) missing.push('หลักฐานปิดงาน');
    return missing;
  }

  function getConsistencyIssues(item, workflowKey) {
    const issues = [];
    const earlySteps = ['new', 'fin', 'att', 'tl_wait', 'tl_process'];
    if (parseMoney(item.deposit) > 0 && isReturnYes(item.depReturn) && earlySteps.includes(workflowKey)) {
      issues.push('ระบุว่าคืนประกันติดตั้งแล้ว แต่ขั้นตอนงานยังไม่ถึงการคืนเงิน');
    }
    if (parseMoney(item.deposit) > 0 && !isReturnYes(item.depReturn) && workflowKey === 'done') {
      issues.push('ปิดงานแล้ว แต่ยังไม่ระบุการคืนประกันติดตั้ง');
    }
    if (parseMoney(item.demolish) === 0 && isReturnYes(item.demoReturn)) {
      issues.push('ระบุคืนประกันรื้อถอน แต่ไม่มียอดประกันรื้อถอน');
    }
    return issues;
  }

  function getSmartWorkQueue(items, options) {
    const config = options || {};
    const now = parseDateValue(config.now) || new Date();
    const statusResolver = typeof config.statusResolver === 'function'
      ? config.statusResolver
      : item => isOffServicePendingItem(item)
        ? 'off_service_pending'
        : (normalize(item && (item.workflowKey || item.status)) || 'new');
    const statusLabelResolver = typeof config.statusLabelResolver === 'function'
      ? config.statusLabelResolver
      : item => statusResolver(item);

    return (items || []).filter(item => !isCancelled(item) && !isOnServiceItem(item)).map(item => {
      const workflowKey = statusResolver(item);
      const lastActivityDate = getLastActivityDate(item);
      const ageDays = daysBetween(lastActivityDate || item.dateReq || item.createdAt, now) || 0;
      const dueSource = ['tl_wait', 'tl_process'].includes(workflowKey)
        ? (item.tl_due_date || item.dateDue)
        : workflowKey === 'off_service_pending'
          ? (item.off_service_due_date || item.dateDue)
          : item.dateDue;
      const dueDate = parseDateValue(dueSource);
      const overdueDays = dueDate && dayStart(dueDate) < dayStart(now) ? daysBetween(dueDate, now) : 0;
      const dueInDays = dueDate && dayStart(dueDate) >= dayStart(now) ? daysBetween(now, dueDate) : null;
      const outstandingAmount = getOutstandingAmount(item);
      const missingDocuments = getMissingDocumentLabels(item, workflowKey);
      const consistencyIssues = getConsistencyIssues(item, workflowKey);
      if (isFullyCompleted(item) && outstandingAmount === 0 && consistencyIssues.length === 0) return null;
      const reasons = [];
      let score = 0;

      if (overdueDays > 0) {
        score += 35 + Math.min(15, overdueDays);
        reasons.push(`เกินกำหนด ${overdueDays} วัน`);
      } else if (dueInDays != null && dueInDays <= 3) {
        score += dueInDays === 0 ? 30 : 20 - (dueInDays * 3);
        reasons.push(dueInDays === 0 ? 'ครบกำหนดวันนี้' : `ครบกำหนดใน ${dueInDays} วัน`);
      }
      if (ageDays >= 14) {
        score += 25;
        reasons.push(`ค้าง${statusLabelResolver(item)}ประมาณ ${ageDays} วัน`);
      } else if (ageDays >= 7) {
        score += 15;
        reasons.push(`ค้าง${statusLabelResolver(item)}ประมาณ ${ageDays} วัน`);
      } else if (ageDays >= 3) {
        score += 8;
        reasons.push(`ค้าง${statusLabelResolver(item)}ประมาณ ${ageDays} วัน`);
      }
      if (ageDays >= 14) {
        score += 20;
        reasons.push(`ไม่มีความเคลื่อนไหว ${ageDays} วัน`);
      } else if (ageDays >= 7) {
        score += 12;
        reasons.push(`ไม่มีความเคลื่อนไหว ${ageDays} วัน`);
      }
      if (outstandingAmount >= 100000) score += 15;
      else if (outstandingAmount >= 50000) score += 10;
      else if (outstandingAmount >= 10000) score += 5;
      if (outstandingAmount > 0) reasons.push(`ยอดประกันคงค้าง ฿${outstandingAmount.toLocaleString('th-TH')}`);
      if (missingDocuments.length > 0) {
        score += Math.min(30, missingDocuments.length * 12);
        reasons.push(`ขาด ${missingDocuments.join(', ')}`);
      }
      if (consistencyIssues.length > 0) {
        score += Math.min(40, consistencyIssues.length * 25);
        reasons.push(...consistencyIssues);
      }
      if (!dueDate) reasons.push('ไม่มีข้อมูลวันครบกำหนด');

      const priority = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
      return {
        item,
        score,
        priority,
        workflowKey,
        ageDays,
        overdueDays,
        dueInDays,
        dueDate,
        lastActivityDate,
        outstandingAmount,
        missingDocuments,
        consistencyIssues,
        reasons
      };
    }).filter(result => result && result.score > 0).sort((a, b) =>
      b.score - a.score || b.outstandingAmount - a.outstandingAmount || b.ageDays - a.ageDays
    );
  }

  function getActionNotifications(items, options) {
    const config = options || {};
    const now = parseDateValue(config.now) || new Date();
    const statusResolver = typeof config.statusResolver === 'function'
      ? config.statusResolver
      : item => isOffServicePendingItem(item)
        ? 'off_service_pending'
        : (normalize(item && (item.workflowKey || item.status)) || 'new');
    const statusLabelResolver = typeof config.statusLabelResolver === 'function'
      ? config.statusLabelResolver
      : item => statusResolver(item);
    const recipientRole = normalize(config.recipientRole);
    const queue = getSmartWorkQueue(items, { now, statusResolver, statusLabelResolver });

    return queue.map(entry => {
      const taskId = String(entry.item.id_firestore || entry.item.id || 'unknown');
      const activityKey = entry.lastActivityDate
        ? entry.lastActivityDate.toISOString().slice(0, 10)
        : 'no-activity';
      const dueSoonDays = entry.dueDate && entry.overdueDays === 0
        ? daysBetween(now, entry.dueDate)
        : null;
      const isDueSoon = dueSoonDays != null && dueSoonDays >= 0 && dueSoonDays <= 3;
      const isOffServicePending = entry.workflowKey === 'off_service_pending';
      const isRoleAction = recipientRole === 'tl'
        ? ['tl_wait', 'off_service_pending'].includes(entry.workflowKey)
        : recipientRole === 'user'
          ? ['ret', 'clo', 'off_service_pending'].includes(entry.workflowKey)
          : false;
      const actionable = entry.priority !== 'low' || isDueSoon || isOffServicePending || isRoleAction;
      if (!actionable) return null;

      let signal = entry.priority;
      let titlePrefix = 'ควรติดตาม';
      let severity = entry.priority === 'high' ? 3 : 2;
      if (entry.overdueDays > 0) {
        signal = 'overdue';
        titlePrefix = `เกินกำหนด ${entry.overdueDays} วัน`;
        severity = 3;
      } else if (isDueSoon) {
        signal = 'due-soon';
        titlePrefix = dueSoonDays === 0 ? 'ครบกำหนดวันนี้' : `ครบกำหนดใน ${dueSoonDays} วัน`;
        severity = dueSoonDays === 0 ? 3 : 2;
      } else if (isOffServicePending) {
        signal = 'off-service';
        titlePrefix = 'รอดำเนินการ Off Service';
        severity = 3;
      } else if (recipientRole === 'tl' && entry.workflowKey === 'tl_wait') {
        signal = 'tl-assigned';
        titlePrefix = 'มีงานใหม่รอ TL รับงาน';
        severity = 2;
      } else if (recipientRole === 'user' && entry.workflowKey === 'ret') {
        signal = 'user-review';
        titlePrefix = 'งานรอ User ตรวจรับ';
        severity = 2;
      } else if (recipientRole === 'user' && entry.workflowKey === 'clo') {
        signal = 'user-close';
        titlePrefix = 'งานรอแนบหลักฐานปิดงาน';
        severity = 2;
      }

      const reasons = entry.reasons.filter(reason => reason !== 'ไม่มีข้อมูลวันครบกำหนด');
      return {
        id: `work:${taskId}:${entry.workflowKey}:${signal}:${activityKey}`,
        taskId,
        type: signal,
        severity,
        title: `${titlePrefix}: ${String(entry.item.place || 'ไม่ระบุอาคาร')}`,
        detail: reasons.slice(0, 2).join(' · ') || statusLabelResolver(entry.item),
        workflowKey: entry.workflowKey,
        dueDate: entry.dueDate,
        createdAt: entry.lastActivityDate || now,
        score: entry.score
      };
    }).filter(Boolean).sort((a, b) =>
      b.severity - a.severity || b.score - a.score || b.createdAt - a.createdAt
    );
  }

  function getRefundCompletionDate(item) {
    const explicit = [item && item.date_return, item && item.date_accounting, item && item.dateAcc]
      .map(parseDateValue).filter(Boolean).sort((a, b) => b - a)[0];
    return explicit || getLastActivityDate(item);
  }

  function getOperationalAnalytics(items, options) {
    const config = options || {};
    const now = parseDateValue(config.now) || new Date();
    const statusResolver = typeof config.statusResolver === 'function'
      ? config.statusResolver
      : item => isOffServicePendingItem(item)
        ? 'off_service_pending'
        : (normalize(item && (item.workflowKey || item.status)) || 'new');
    const statusLabelResolver = typeof config.statusLabelResolver === 'function'
      ? config.statusLabelResolver
      : item => statusResolver(item);
    const activeItems = (items || []).filter(item => !isCancelled(item));
    // On Service is a normal holding state while the customer is still using the service.
    // It becomes actionable only after a service-cancellation request is recorded.
    const openItems = activeItems.filter(item => !isFullyCompleted(item) && !isOnServiceItem(item));
    const queue = getSmartWorkQueue(activeItems, { now, statusResolver, statusLabelResolver });

    const stages = {};
    openItems.forEach(item => {
      const key = statusResolver(item);
      if (!stages[key]) stages[key] = { key, label: statusLabelResolver(item), count: 0, totalAgeDays: 0 };
      stages[key].count += 1;
      stages[key].totalAgeDays += daysBetween(getLastActivityDate(item) || item.dateReq || item.createdAt, now) || 0;
    });
    const stageAges = Object.values(stages).map(stage => ({
      ...stage,
      averageAgeDays: stage.count ? stage.totalAgeDays / stage.count : 0
    })).sort((a, b) => b.averageAgeDays - a.averageAgeDays || b.count - a.count);

    const refundDurations = [];
    activeItems.forEach(item => {
      const hasRefund = isInstallationRefunded(item);
      if (!hasRefund) return;
      const start = parseDateValue(item.dateReq || item.createdAt);
      const end = getRefundCompletionDate(item);
      const durationDays = daysBetween(start, end);
      if (durationDays == null) return;
      refundDurations.push({ item, durationDays });
    });

    const groupDuration = field => {
      const groups = {};
      refundDurations.forEach(entry => {
        const key = String(entry.item[field] || 'ไม่ระบุ').trim() || 'ไม่ระบุ';
        if (!groups[key]) groups[key] = { label: key, count: 0, totalDays: 0 };
        groups[key].count += 1;
        groups[key].totalDays += entry.durationDays;
      });
      return Object.values(groups).map(group => ({
        ...group,
        averageDays: group.count ? group.totalDays / group.count : 0
      })).sort((a, b) => b.averageDays - a.averageDays || b.count - a.count);
    };

    const monthAmount = (year, month) => activeItems.reduce((sum, item) => {
      const date = parseDateValue(item.dateReq || item.createdAt);
      if (!date || date.getFullYear() !== year || date.getMonth() !== month) return sum;
      return sum + parseMoney(item.deposit) + parseMoney(item.demolish);
    }, 0);
    const monthCount = (year, month) => activeItems.filter(item => {
      const date = parseDateValue(item.dateReq || item.createdAt);
      return date && date.getFullYear() === year && date.getMonth() === month;
    }).length;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const previousDate = new Date(currentYear, currentMonth - 1, 1);
    const currentAmount = monthAmount(currentYear, currentMonth);
    const previousAmount = monthAmount(previousDate.getFullYear(), previousDate.getMonth());
    const percentChange = previousAmount > 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : null;

    const dueDateCount = openItems.filter(item => parseDateValue(item.dateDue)).length;
    const overdueEntries = queue.filter(entry => entry.overdueDays > 0);
    const accuracy = {
      dueDateCoveragePct: openItems.length ? dueDateCount / openItems.length * 100 : 100,
      dueDateCount,
      openCount: openItems.length,
      refundDurationCoveragePct: activeItems.length ? refundDurations.length / activeItems.length * 100 : 100,
      refundDurationCount: refundDurations.length,
      totalCount: activeItems.length,
      stageAgeIsEstimated: true
    };

    return {
      queue,
      stageAges,
      bottleneck: stageAges[0] || null,
      refundByArea: groupDuration('area'),
      refundByBuilding: groupDuration('place'),
      overdueRiskAmount: overdueEntries.reduce((sum, entry) => sum + entry.outstandingAmount, 0),
      overdueCount: overdueEntries.length,
      monthComparison: {
        currentAmount,
        previousAmount,
        currentCount: monthCount(currentYear, currentMonth),
        previousCount: monthCount(previousDate.getFullYear(), previousDate.getMonth()),
        percentChange
      },
      accuracy
    };
  }

  root.DepositDomain = {
    normalize, parseMoney, isReturnYes, isCancelled, hasRemovalDeposit,
    isInstallationRefunded,
    isRemovalRefunded, isInstallationClosed, isOffServicePendingItem, isOnServiceItem, isPreServiceItem, isFullyCompleted,
    sortCompletedLast, getRemovalDepositMetrics, getInstallationDepositMetrics,
    getNonRefundableCostMetrics, getSidebarFinancialMetrics, getListPageKpiMetrics,
    parseDateValue, daysBetween, getLastActivityDate, getOutstandingAmount,
    getMissingDocumentLabels, getConsistencyIssues, getSmartWorkQueue, getActionNotifications, getOperationalAnalytics
  };
})(typeof window !== 'undefined' ? window : globalThis);
