import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Canvas } = require("C:/Users/kobpat_m/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/node_modules/skia-canvas");

const artifact = await import("file:///C:/Users/kobpat_m/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs");
const {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  panel,
  text,
  rule,
  fill,
  hug,
  fixed,
  grow,
  fr
} = artifact;

const outDir = path.resolve("deliverables");
const previewDir = path.join(outDir, "previews");
fs.mkdirSync(previewDir, { recursive: true });

const C = {
  ink: "#172033",
  muted: "#64748B",
  line: "#D8E2EA",
  cloud: "#F8FAFC",
  white: "#FFFFFF",
  navy: "#0B1220",
  blue: "#2563EB",
  blueDark: "#1E3A8A",
  sky: "#E0F2FE",
  teal: "#0F766E",
  green: "#16A34A",
  amber: "#D97706",
  violet: "#7C3AED",
  red: "#DC2626"
};

const presentation = Presentation.create({ slideSize: { width: 1920, height: 1080 } });

const style = {
  coverTitle: { fontSize: 66, bold: true, color: C.white, fontFamily: "Tahoma" },
  coverSub: { fontSize: 32, color: "#BAE6FD", fontFamily: "Tahoma" },
  title: { fontSize: 44, bold: true, color: C.ink, fontFamily: "Tahoma" },
  sub: { fontSize: 20, color: C.muted, fontFamily: "Tahoma" },
  h: { fontSize: 26, bold: true, color: C.ink, fontFamily: "Tahoma" },
  body: { fontSize: 21, color: C.ink, fontFamily: "Tahoma" },
  small: { fontSize: 16, color: C.muted, fontFamily: "Tahoma" },
  tiny: { fontSize: 13, color: "#8A97A6", fontFamily: "Tahoma" }
};

function t(value, opts = {}) {
  return text(value, {
    name: opts.name,
    width: opts.width ?? fill,
    height: opts.height ?? hug,
    style: opts.style ?? style.body
  });
}

function titleBlock(title, subtitle) {
  return column(
    { name: "title-block", width: fill, height: hug, gap: 16 },
    [
      t(title, { name: "slide-title", style: style.title }),
      subtitle ? t(subtitle, { name: "slide-subtitle", style: style.sub }) : undefined,
      rule({ name: "title-rule", width: fill, stroke: C.line, weight: 2 })
    ].filter(Boolean)
  );
}

function root(slide, children, opts = {}) {
  slide.compose(
    column(
      {
        name: "root",
        width: fill,
        height: fill,
        padding: { x: opts.px ?? 80, y: opts.py ?? 58 },
        gap: opts.gap ?? 34,
        fill: opts.fill ?? C.cloud
      },
      children
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 }
  );
}

function card(title, body, color = C.blue, opts = {}) {
  return panel(
    {
      name: opts.name,
      width: opts.width ?? fill,
      height: opts.height ?? fixed(190),
      padding: { x: 28, y: 24 },
      fill: C.white,
      stroke: color,
      borderRadius: 18
    },
    column(
      { width: fill, height: fill, gap: 12 },
      [
        t(title, { style: { ...style.h, color, fontSize: opts.titleSize ?? 24 } }),
        t(body, { style: { ...style.small, color: C.ink, fontSize: opts.bodySize ?? 17 } })
      ]
    )
  );
}

function chip(label, color) {
  return panel(
    { width: hug, height: fixed(44), padding: { x: 18, y: 9 }, fill: color, stroke: color, borderRadius: 22 },
    t(label, { width: hug, style: { fontSize: 15, bold: true, color: C.white, fontFamily: "Tahoma" } })
  );
}

function bullets(items, color = C.blue, size = 19) {
  return column(
    { width: fill, height: hug, gap: 14 },
    items.map((item) =>
      row(
        { width: fill, height: hug, gap: 12, align: "start" },
        [
          t("•", { width: fixed(18), style: { fontSize: size + 3, bold: true, color, fontFamily: "Tahoma" } }),
          t(item, { style: { fontSize: size, color: C.ink, fontFamily: "Tahoma" } })
        ]
      )
    )
  );
}

function footer(n) {
  return t(`ประเมินจากโค้ดระบบ ณ 15 พ.ค. 2026 • ${n}`, {
    name: `footer-${n}`,
    style: { ...style.tiny, color: "#94A3B8" }
  });
}

function addPreview(name, title, lines) {
  const canvas = new Canvas(1600, 900);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.cloud;
  ctx.fillRect(0, 0, 1600, 900);
  ctx.fillStyle = C.white;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(70, 70, 1460, 760, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.blue;
  ctx.fillRect(70, 70, 1460, 18);
  ctx.fillStyle = C.ink;
  ctx.font = "700 48px Tahoma";
  ctx.fillText(title, 86, 150);
  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.moveTo(86, 184);
  ctx.lineTo(1510, 184);
  ctx.stroke();
  ctx.font = "30px Tahoma";
  lines.forEach((line, i) => ctx.fillText(String(line), 86, 250 + i * 54));
  return canvas.toBuffer("png").then((buf) => fs.promises.writeFile(path.join(previewDir, `${name}.png`), buf));
}

const previews = [];

// 1 Cover
{
  const slide = presentation.slides.add();
  slide.compose(
    column(
      { name: "cover", width: fill, height: fill, fill: C.navy, padding: { x: 96, y: 96 }, gap: 34 },
      [
        t("ระบบขอคืนเงินประกันอาคาร", { style: style.coverTitle }),
        t("Workflow Diagram และ Private Cloud Sizing", { style: style.coverSub }),
        row({ width: fill, height: hug, gap: 16 }, [
          chip("Frontend", C.blue),
          chip("Firestore", C.teal),
          chip("Storage", C.violet),
          chip("Dashboard", C.amber),
          chip("TL Workflow", C.green)
        ]),
        t("สรุปภาพรวมสำหรับผู้บริหาร: ระบบปัจจุบัน, เส้นทางข้อมูล, ทรัพยากรที่ใช้ และ Spec แนะนำสำหรับย้ายขึ้น Private Cloud", {
          style: { fontSize: 25, color: "#D8E2EA", fontFamily: "Tahoma" }
        }),
        t("Prepared for Executive Review • 15 พฤษภาคม 2026", {
          style: { fontSize: 20, color: "#CBD5E1", fontFamily: "Tahoma" }
        })
      ]
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 }
  );
  previews.push(addPreview("slide-01-cover", "ระบบขอคืนเงินประกันอาคาร", ["Workflow Diagram และ Private Cloud Sizing", "Prepared for Executive Review"]));
}

// 2 Summary
{
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Executive Summary", "ระบบเป็นเว็บแอปหน้าเดียวที่ใช้ Firebase เป็น backend โดยตรง เหมาะกับการย้ายเป็น Private Cloud แบบ container + managed data services"),
    grid(
      { width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 28, rowGap: 28 },
      [
        card("รูปแบบปัจจุบัน", "Static HTML/JS + Firebase SDK\nไม่มี application server ใน repo", C.blue),
        card("ข้อมูลหลัก", "Firestore collections: deposits, users,\npassword_reset_requests", C.teal),
        card("เอกสารแนบ", "PDF/JPG/PNG อัปโหลดไป Storage\nจำกัดขนาดไฟล์ 20 MB ต่อไฟล์", C.amber),
        card("การใช้งาน", "role admin / user / tl\nมี dashboard และ real-time update", C.violet),
        card("Private Cloud Target", "Web + API + DB + Object Storage\nเพิ่ม IAM, audit, backup และ monitoring", C.green, { width: fill })
      ]
    ),
    footer(2)
  ]);
  previews.push(addPreview("slide-02-summary", "Executive Summary", ["Static HTML/JS + Firebase SDK", "Firestore: deposits, users, password reset", "Private Cloud: Web + API + DB + Object Storage"]));
}

// 3 Current architecture
{
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Current Architecture", "ภาพรวมจากไฟล์ index.html, firebase-client.js และ firebase-config.js"),
    row({ width: fill, height: grow(1), gap: 22, align: "center" }, [
      card("ผู้ใช้งาน", "Admin / User / TL\nBrowser session", C.blue, { width: fixed(245), height: fixed(210), bodySize: 18 }),
      t("→", { width: fixed(48), style: { fontSize: 44, bold: true, color: C.blue, fontFamily: "Tahoma" } }),
      column({ width: fixed(290), height: hug, gap: 18 }, [
        card("Static Web", "index.html", C.blue, { height: fixed(118), bodySize: 18 }),
        card("Firebase SDK", "compat v10.7.1", C.blue, { height: fixed(118), bodySize: 18 })
      ]),
      t("→", { width: fixed(48), style: { fontSize: 44, bold: true, color: C.teal, fontFamily: "Tahoma" } }),
      column({ width: fixed(320), height: hug, gap: 18 }, [
        card("Firestore", "business data", C.teal, { height: fixed(112), bodySize: 18 }),
        card("Cloud Storage", "PDF / image files", C.amber, { height: fixed(112), bodySize: 18 }),
        card("Session state", "sessionStorage", C.violet, { height: fixed(112), bodySize: 18 })
      ]),
      t("→", { width: fixed(48), style: { fontSize: 44, bold: true, color: C.blue, fontFamily: "Tahoma" } }),
      card("Outputs", "Dashboard\nCSV Export\nNotifications", C.green, { width: fixed(250), height: fixed(210), bodySize: 18 })
    ]),
    panel({ width: fill, height: fixed(72), padding: 18, fill: "#FFF7ED", stroke: "#FDBA74", borderRadius: 14 },
      t("หมายเหตุ: โค้ด client เรียกฐานข้อมูลและ storage โดยตรง จึงควรเพิ่ม backend/API layer เมื่อย้ายเข้า Private Cloud เพื่อควบคุมสิทธิ์และ audit ได้แน่นขึ้น", { style: { fontSize: 18, bold: true, color: C.amber, fontFamily: "Tahoma" } })
    ),
    footer(3)
  ]);
  previews.push(addPreview("slide-03-current-architecture", "Current Architecture", ["Users → Static Web / Firebase SDK", "Firestore + Cloud Storage + Session state", "Dashboard, CSV Export, Notifications"]));
}

// 4 Workflow
{
  const steps = [
    ["1", "ข้อมูลทั่วไป", "อาคาร ลูกค้า เจ้าของงาน พื้นที่"],
    ["2", "การเงิน", "PR วันที่ตั้งเบิก งบประมาณ"],
    ["3", "แนบหลักฐาน", "Payment / Drawing / เอกสารเพิ่ม"],
    ["4", "TL ดำเนินการ", "auto route BKK/UPC ตาม area"],
    ["5", "ตรวจรับ/ขอคืน", "User รับงานหรือส่งกลับ TL"],
    ["6", "ปิดงาน", "แนบหลักฐานคืนเงิน/ปิดจบ"]
  ];
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Workflow การขอคืนเงินประกัน", "เส้นทางหลัก 6 ขั้นจาก wizard และ status transition ใน submitForm()"),
    row(
      { width: fill, height: fixed(265), gap: 10, align: "center" },
      steps.flatMap((s, i) => [
        panel(
          { width: fixed(235), height: fixed(225), padding: { x: 18, y: 18 }, fill: C.white, stroke: [C.blue, C.blue, C.amber, C.violet, C.teal, C.green][i], borderRadius: 16 },
          column({ width: fill, height: fill, gap: 12 }, [
            t(s[0], { style: { fontSize: 30, bold: true, color: [C.blue, C.blue, C.amber, C.violet, C.teal, C.green][i], fontFamily: "Tahoma" } }),
            t(s[1], { style: { fontSize: 20, bold: true, color: C.ink, fontFamily: "Tahoma" } }),
            t(s[2], { style: { fontSize: 15, color: C.muted, fontFamily: "Tahoma" } })
          ])
        ),
        i < steps.length - 1 ? t("→", { width: fixed(28), style: { fontSize: 28, bold: true, color: C.blue, fontFamily: "Tahoma" } }) : undefined
      ].filter(Boolean))
    ),
    row({ width: fill, height: hug, gap: 22 }, [
      card("ส่งกลับก่อนรับงาน", "TL ส่งกลับเมื่อข้อมูลไม่ครบ → Step 3", C.red, { height: fixed(120), bodySize: 16 }),
      card("ส่งกลับแก้ไข", "User ส่งกลับเมื่อหลักฐาน TL ไม่ถูกต้อง → Step 4", C.amber, { height: fixed(120), bodySize: 16 }),
      card("ปิดงานอัตโนมัติ", "หากไม่มียอดการเงิน ระบบปิดงานเองหลังผ่านข้อมูลครบ", C.green, { height: fixed(120), bodySize: 16 })
    ]),
    footer(4)
  ]);
  previews.push(addPreview("slide-04-workflow", "Workflow การขอคืนเงินประกัน", steps.map(([n, h]) => `${n}. ${h}`)));
}

// 5 Data flow
{
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Data & Document Flow", "ข้อมูลธุรกรรมอยู่ใน Firestore ส่วนไฟล์แนบอยู่ใน Storage และถูกอ้างอิงผ่าน URL ในรายการงาน"),
    row({ width: fill, height: grow(1), gap: 24, align: "center" }, [
      card("Client Browser", "form wizard\ndashboard\nCSV export\nreal-time listener", C.blue, { width: fixed(285), height: fixed(320), bodySize: 18 }),
      t("→", { width: fixed(52), style: { fontSize: 44, bold: true, color: C.blue, fontFamily: "Tahoma" } }),
      column({ width: fixed(330), height: hug, gap: 16 }, [
        card("deposits", "รายการงาน / สถานะ / audit log", C.teal, { height: fixed(108), bodySize: 16 }),
        card("users", "employee_id / role / area / permissions", C.violet, { height: fixed(108), bodySize: 16 }),
        card("password_reset_requests", "ประวัติคำขอ reset", C.amber, { height: fixed(108), bodySize: 16 })
      ]),
      t("+", { width: fixed(44), style: { fontSize: 42, bold: true, color: C.amber, fontFamily: "Tahoma" } }),
      card("Storage folders", "payments\nlayouts\nadditional\ntl_works\ntl_extra\nfinal_docs", C.amber, { width: fixed(270), height: fixed(320), bodySize: 18 }),
      t("→", { width: fixed(52), style: { fontSize: 44, bold: true, color: C.green, fontFamily: "Tahoma" } }),
      card("Business outputs", "KPI cards\nExecutive dashboard\nTL task board\nNotifications\nAudit log", C.green, { width: fixed(285), height: fixed(320), bodySize: 18 })
    ]),
    footer(5)
  ]);
  previews.push(addPreview("slide-05-data-flow", "Data & Document Flow", ["Firestore: deposits / users / password reset", "Storage: payments, layouts, tl_works, final_docs"]));
}

// 6 Target architecture
{
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Target Private Cloud Architecture", "แนะนำเพิ่ม API layer เพื่อย้าย business rules และสิทธิ์ออกจาก browser"),
    row({ width: fill, height: grow(1), gap: 18, align: "center" }, [
      card("Users", "Web / Mobile browser", C.blue, { width: fixed(210), height: fixed(145), bodySize: 16 }),
      t("→", { width: fixed(36), style: { fontSize: 38, bold: true, color: C.blue, fontFamily: "Tahoma" } }),
      column({ width: fixed(270), height: hug, gap: 16 }, [
        card("WAF / Reverse Proxy", "TLS termination", C.blue, { height: fixed(108), bodySize: 16 }),
        card("Static Web", "Nginx / CDN", C.blue, { height: fixed(108), bodySize: 16 })
      ]),
      t("→", { width: fixed(36), style: { fontSize: 38, bold: true, color: C.teal, fontFamily: "Tahoma" } }),
      column({ width: fixed(300), height: hug, gap: 16 }, [
        card("API Service", "Node.js / container", C.teal, { height: fixed(108), bodySize: 16 }),
        card("Auth / RBAC", "SSO or local IAM", C.violet, { height: fixed(108), bodySize: 16 })
      ]),
      t("→", { width: fixed(36), style: { fontSize: 38, bold: true, color: C.green, fontFamily: "Tahoma" } }),
      column({ width: fixed(300), height: hug, gap: 16 }, [
        card("PostgreSQL HA", "primary / standby", C.teal, { height: fixed(112), bodySize: 15 }),
        card("Object Storage", "S3-compatible", C.amber, { height: fixed(112), bodySize: 15 }),
        card("Redis / Queue", "cache / background jobs", C.red, { height: fixed(112), bodySize: 15 })
      ]),
      card("Monitoring\nBackup\nAudit Logs", "metrics + alerting", C.green, { width: fixed(240), height: fixed(185), bodySize: 15 })
    ]),
    panel({ width: fill, height: fixed(74), padding: 18, fill: "#ECFDF5", stroke: "#86EFAC", borderRadius: 14 },
      t("เหตุผล: ลดการเข้าถึงข้อมูลตรงจาก client, บังคับใช้ workflow/validation ฝั่ง server, เก็บ audit ได้ครบ และทำ backup/DR ได้ตามนโยบายองค์กร", { style: { fontSize: 18, bold: true, color: C.teal, fontFamily: "Tahoma" } })
    ),
    footer(6)
  ]);
  previews.push(addPreview("slide-06-target-architecture", "Target Private Cloud Architecture", ["WAF → Static Web + API Service", "API → PostgreSQL HA + Object Storage + Redis/Queue"]));
}

// 7 Assumptions
{
  const rows = [
    ["ผู้ใช้", "50-200 named users, 20-50 concurrent sessions"],
    ["รายการงาน", "10k-100k records ในช่วง 3-5 ปี"],
    ["ไฟล์แนบ", "PDF/JPG/PNG สูงสุด 20 MB ต่อไฟล์, เฉลี่ย 3-5 ไฟล์ต่อรายการ"],
    ["รูปแบบโหลด", "อ่านรายการ/dashboard บ่อยกว่าเขียน, มี real-time/notification"],
    ["ความพร้อมใช้", "งานภายในที่ควรมี HA ขั้นพื้นฐานและ backup รายวัน"],
    ["การโต", "เผื่อพื้นที่ object storage โตเร็วกว่า database"]
  ];
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Sizing Assumptions", "ไม่มี telemetry จริงใน repo จึงประเมินแบบ conservative สำหรับระบบเอกสารภายใน"),
    column(
      { width: fill, height: grow(1), gap: 13 },
      rows.map(([k, v]) =>
        panel({ width: fill, height: fixed(74), padding: { x: 24, y: 16 }, fill: C.white, stroke: C.line, borderRadius: 12 },
          row({ width: fill, height: hug, gap: 28 }, [
            t(k, { width: fixed(250), style: { fontSize: 22, bold: true, color: C.blueDark, fontFamily: "Tahoma" } }),
            t(v, { style: { fontSize: 20, color: C.ink, fontFamily: "Tahoma" } })
          ])
        )
      )
    ),
    panel({ width: fill, height: fixed(74), padding: 18, fill: "#FFF7ED", stroke: "#FDBA74", borderRadius: 14 },
      t("ข้อควรยืนยันก่อนจัดซื้อจริง: จำนวนผู้ใช้พร้อมกัน, retention เอกสาร, RPO/RTO, นโยบาย SSO และข้อกำหนด security ขององค์กร", { style: { fontSize: 18, bold: true, color: C.amber, fontFamily: "Tahoma" } })
    ),
    footer(7)
  ]);
  previews.push(addPreview("slide-07-assumptions", "Sizing Assumptions", rows.map(([k, v]) => `${k}: ${v}`)));
}

// 8 Spec
{
  const rows = [
    ["Load Balancer / WAF", "2 VM", "2 vCPU / 4 GB RAM / 40 GB", "HA, TLS termination, reverse proxy"],
    ["Web + API", "2 VM", "4 vCPU / 8 GB RAM / 80 GB", "รองรับ UI/API, validation, RBAC, background tasks เบา"],
    ["Database", "2 VM", "4-8 vCPU / 16-32 GB RAM / 300 GB SSD", "PostgreSQL primary/standby, audit และ dashboard queries"],
    ["Object Storage", "3 node", "4 vCPU / 16 GB RAM / 2 TB usable+", "เก็บ PDF/JPG/PNG, replication, lifecycle policy"],
    ["Monitoring / Log", "1 VM", "4 vCPU / 8 GB RAM / 300 GB", "metrics, centralized logs, alerting"],
    ["Backup Repository", "1 target", "เริ่ม 2-4 TB ตาม retention", "daily backup, monthly archive, restore test"]
  ];
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Recommended Private Cloud Spec", "Spec แนะนำสำหรับเริ่ม production พร้อม HA ขั้นพื้นฐาน และเผื่อขยาย"),
    column(
      { width: fill, height: grow(1), gap: 0 },
      [
        panel({ width: fill, height: fixed(54), padding: { x: 18, y: 12 }, fill: C.blueDark, stroke: C.blueDark, borderRadius: 12 },
          row({ width: fill, height: hug, gap: 14 }, [
            t("Layer", { width: fixed(285), style: { fontSize: 17, bold: true, color: C.white, fontFamily: "Tahoma" } }),
            t("จำนวน", { width: fixed(145), style: { fontSize: 17, bold: true, color: C.white, fontFamily: "Tahoma" } }),
            t("Spec ต่อ node", { width: fixed(430), style: { fontSize: 17, bold: true, color: C.white, fontFamily: "Tahoma" } }),
            t("เหตุผล", { style: { fontSize: 17, bold: true, color: C.white, fontFamily: "Tahoma" } })
          ])
        ),
        ...rows.map((r) =>
          panel({ width: fill, height: fixed(78), padding: { x: 18, y: 14 }, fill: C.white, stroke: C.line, borderRadius: 0 },
            row({ width: fill, height: hug, gap: 14 }, [
              t(r[0], { width: fixed(285), style: { fontSize: 16, bold: true, color: C.ink, fontFamily: "Tahoma" } }),
              t(r[1], { width: fixed(145), style: { fontSize: 16, color: C.ink, fontFamily: "Tahoma" } }),
              t(r[2], { width: fixed(430), style: { fontSize: 15, color: C.ink, fontFamily: "Tahoma" } }),
              t(r[3], { style: { fontSize: 15, color: C.muted, fontFamily: "Tahoma" } })
            ])
          )
        )
      ]
    ),
    panel({ width: fill, height: fixed(66), padding: 18, fill: "#ECFDF5", stroke: "#86EFAC", borderRadius: 14 },
      t("รวมประมาณ: 17-23 vCPU, 80-120 GB RAM, storage เริ่ม 3-6 TB usable ขึ้นกับ retention และจำนวนไฟล์จริง", { style: { fontSize: 18, bold: true, color: C.teal, fontFamily: "Tahoma" } })
    ),
    footer(8)
  ], { gap: 24 });
  previews.push(addPreview("slide-08-private-cloud-spec", "Recommended Private Cloud Spec", ["2 LB/WAF, 2 Web+API, 2 DB, 3 Object Storage nodes", "Start: ~17-23 vCPU, 80-120 GB RAM, 3-6 TB usable storage"]));
}

// 9 Security and ops
{
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Security, Backup & Operations", "ประเด็นที่ควรทำควบคู่กับการย้ายขึ้น Private Cloud"),
    row({ width: fill, height: grow(1), gap: 28 }, [
      panel({ width: fill, height: fill, padding: 28, fill: C.white, stroke: C.red, borderRadius: 16 }, column({ width: fill, height: fill, gap: 18 }, [
        t("Security", { style: { ...style.h, color: C.red } }),
        bullets(["ย้าย password/role validation ไป server", "Hash password หรือเชื่อม SSO/IAM", "ใช้ signed URL สำหรับไฟล์แนบ", "WAF + TLS + network segmentation"], C.red, 18)
      ])),
      panel({ width: fill, height: fill, padding: 28, fill: C.white, stroke: C.teal, borderRadius: 16 }, column({ width: fill, height: fill, gap: 18 }, [
        t("Data Protection", { style: { ...style.h, color: C.teal } }),
        bullets(["PostgreSQL PITR / daily snapshot", "Object storage versioning + lifecycle", "เข้ารหัส at rest/in transit", "restore test รายไตรมาส"], C.teal, 18)
      ])),
      panel({ width: fill, height: fill, padding: 28, fill: C.white, stroke: C.blue, borderRadius: 16 }, column({ width: fill, height: fill, gap: 18 }, [
        t("Operations", { style: { ...style.h, color: C.blue } }),
        bullets(["centralized log + audit trail", "alert: error rate, storage quota, DB latency", "CI/CD สำหรับ static web และ API", "runbook สำหรับ incident และ DR"], C.blue, 18)
      ]))
    ]),
    footer(9)
  ]);
  previews.push(addPreview("slide-09-ops-security", "Security, Backup & Operations", ["Security: server-side auth/RBAC, signed URLs", "Backup: PITR, versioning, restore tests", "Ops: logs, alerts, CI/CD, runbooks"]));
}

// 10 Roadmap
{
  const phases = [
    ["Phase 1", "Stabilize", "สำรวจข้อมูลจริง, retention, สิทธิ์ผู้ใช้, export schema จาก Firebase"],
    ["Phase 2", "Backend Layer", "สร้าง API/RBAC, migrate validation, audit log, signed file access"],
    ["Phase 3", "Private Cloud Pilot", "deploy HA baseline, migrate sample data, performance & restore test"],
    ["Phase 4", "Cutover", "freeze window, final migration, training, monitoring war room"]
  ];
  const slide = presentation.slides.add();
  root(slide, [
    titleBlock("Implementation Roadmap", "แนวทางดำเนินการเพื่อลดความเสี่ยงและคุมงบประมาณ"),
    row({ width: fill, height: grow(1), gap: 18, align: "center" }, phases.flatMap((p, i) => [
      panel({ width: fixed(330), height: fixed(270), padding: 26, fill: C.white, stroke: [C.blue, C.teal, C.amber, C.green][i], borderRadius: 16 },
        column({ width: fill, height: fill, gap: 18 }, [
          chip(p[0], [C.blue, C.teal, C.amber, C.green][i]),
          t(p[1], { style: { fontSize: 25, bold: true, color: [C.blue, C.teal, C.amber, C.green][i], fontFamily: "Tahoma" } }),
          t(p[2], { style: { fontSize: 17, color: C.ink, fontFamily: "Tahoma" } })
        ])
      ),
      i < phases.length - 1 ? t("→", { width: fixed(36), style: { fontSize: 38, bold: true, color: C.blue, fontFamily: "Tahoma" } }) : undefined
    ].filter(Boolean))),
    panel({ width: fill, height: fixed(82), padding: 20, fill: C.navy, stroke: C.navy, borderRadius: 16 },
      t("Decision ขออนุมัติ: เริ่ม Phase 1-2 เพื่อยืนยัน sizing ด้วยข้อมูลจริง แล้วล็อกงบ Private Cloud ก่อน pilot production", { style: { fontSize: 22, bold: true, color: C.white, fontFamily: "Tahoma" } })
    ),
    footer(10)
  ]);
  previews.push(addPreview("slide-10-roadmap", "Implementation Roadmap", phases.map(([p, h]) => `${p}: ${h}`)));
}

await Promise.all(previews);
const pptxPath = path.join(outDir, "private-cloud-workflow-spec.pptx");
const pptxBlob = await PresentationFile.exportPptx(presentation);
await pptxBlob.save(pptxPath);

const inspection = await presentation.inspect({ maxChars: 24000 });
fs.writeFileSync(path.join(outDir, "private-cloud-workflow-spec.inspect.ndjson"), inspection.ndjson, "utf8");

console.log(JSON.stringify({ pptxPath, previewDir, slideCount: presentation.slides.items.length }, null, 2));
process.exit(0);
