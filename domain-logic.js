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

  function isInstallationClosed(item) {
    if (!item || isCancelled(item)) return false;
    const status = normalize(item.status);
    const finalStatus = normalize(item.status_final);
    if (status === 'done' || finalStatus === 'done') return true;

    const isClosingStep = status === 'clo' || finalStatus === 'clo';
    const inspectedByBuilding = normalize(item.inspected_by) === 'building dept';
    return isClosingStep && (inspectedByBuilding || Boolean(item.pdf_user_final));
  }

  function isOnServiceItem(item) {
    return hasRemovalDeposit(item) && isInstallationClosed(item) && !isRemovalRefunded(item);
  }

  function isPreServiceItem(item) {
    return hasRemovalDeposit(item) && !isRemovalRefunded(item) && !isInstallationClosed(item);
  }

  function isFullyCompleted(item) {
    return normalize(item && item.status) === 'done' && !isOnServiceItem(item);
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
      if (isOnServiceItem(item)) {
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
      if (isReturnYes(item && item.depReturn)) {
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

  root.DepositDomain = {
    normalize, parseMoney, isReturnYes, isCancelled, hasRemovalDeposit,
    isRemovalRefunded, isInstallationClosed, isOnServiceItem, isPreServiceItem, isFullyCompleted,
    sortCompletedLast, getRemovalDepositMetrics, getInstallationDepositMetrics,
    getNonRefundableCostMetrics, getSidebarFinancialMetrics
  };
})(typeof window !== 'undefined' ? window : globalThis);
