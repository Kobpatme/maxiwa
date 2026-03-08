// config.js - System Configuration for Prototype Prototype
const SYSTEM_CONFIG = {
  brandName: "ระบบจัดการส่วนกลาง",
  brandSub: "Prototype Framework 2026",
  logo: "🏢",
  apps: [
    {
      id: "deposit-refund",
      name: "คืนเงินประกันอาคาร",
      icon: "📋",
      active: true,
      menu: [
        { id: "dashboard", label: "Executive Dashboard", icon: "📊", role: "user" },
        { id: "list", label: "รายการทั้งหมด", icon: "📋", role: "user", badgeId: "nav-total" },
        { id: "on-process", label: "กำลังดำเนินการ", icon: "⏳", role: "user", badgeId: "nav-process", filter: "On Process" },
        { id: "done", label: "เสร็จแล้ว", icon: "✅", role: "user", badgeId: "nav-done", filter: "Done" },
      ],
      adminMenu: [
        { id: "users", label: "จัดการผู้ใช้งาน", icon: "👥" }
      ]
    }
    // Future apps can be added here
    /*
    ,{
      id: "inventory",
      name: "ระบบคลังสินค้า",
      icon: "📦",
      active: false,
      menu: [...]
    }
    */
  ]
};
