// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as XLSX2 from "xlsx";

// src/services/backupEmailService.ts
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";
var DEFAULT_RECIPIENTS = ["auxlineadiagnostica@syd.com.co", "eljemb22@gmail.com"];
function generateExcelBuffer(payload) {
  const wb = XLSX.utils.book_new();
  const cleanStr = (val) => val === void 0 || val === null ? "" : String(val).trim();
  const data = payload?.data || {};
  const equipments = data.equipments || [];
  const quotes = data.quotes || [];
  const tenderProjects = data.tenderProjects || [];
  const ocContracts = data.ocContracts || [];
  const salesOrders = data.salesOrders || [];
  const salesInvoices = data.salesInvoices || [];
  const technicalDocuments = data.technicalDocuments || [];
  const systemUsers = data.systemUsers || [];
  const catalogRows = equipments.map((eq, idx) => ({
    "ID": eq.id || `eq_${idx + 1}`,
    "C\xF3digo": cleanStr(eq.code),
    "Nombre del Equipo": cleanStr(eq.name),
    "Marca": cleanStr(eq.brand),
    "Modelo": cleanStr(eq.model),
    "Grupo de Producto": eq.productGroup || "Equipos M\xE9dicos",
    "Categor\xEDa": eq.category || "Diagn\xF3stico",
    "Proveedor Principal": cleanStr(eq.supplier),
    "Proveedores Alternos": Array.isArray(eq.allSuppliers) ? eq.allSuppliers.join(", ") : "",
    "Costo Base COP": Number(eq.baseCostCOP) || 0,
    "Costo USD": Number(eq.baseCostUSD) || 0,
    "Lista de Margen Sugerida": eq.defaultMarginList || "L4",
    "IVA Exento": eq.taxExempt ? "S\xCD" : "NO",
    "Tarifa IVA %": eq.taxRate !== void 0 ? Number(eq.taxRate) : eq.taxExempt ? 0 : 19,
    "Registro INVIMA": cleanStr(eq.invimaRecordNumber || "En Tr\xE1mite"),
    "Estado INVIMA": cleanStr(eq.invimaStatus || "Vigente"),
    "Vigencia INVIMA": cleanStr(eq.invimaExpiryDate),
    "Garant\xEDa (Meses)": Number(eq.warrantyMonths) || 24,
    "Pa\xEDs de Origen": cleanStr(eq.originCountry || "Colombia"),
    "Descripci\xF3n Comercial": cleanStr(eq.description),
    "Especificaciones T\xE9cnicas": Array.isArray(eq.technicalSpecs) ? eq.technicalSpecs.join(" | ") : "",
    "Accesorios Est\xE1ndar": Array.isArray(eq.standardAccessories) ? eq.standardAccessories.map((a) => `${a.name}${a.costCOP ? ` ($${a.costCOP})` : ""}`).join(" | ") : ""
  }));
  const wsCatalog = XLSX.utils.json_to_sheet(
    catalogRows.length > 0 ? catalogRows : [{ "C\xF3digo": "EQ-001", "Nombre del Equipo": "Monitor de Signos Vitales", "Marca": "SYD Biomedical", "Modelo": "Pro-10", "Costo Base COP": 45e5 }]
  );
  XLSX.utils.book_append_sheet(wb, wsCatalog, "1_Catalogo_Equipos");
  const quoteRows = quotes.map((q) => ({
    "N\xB0 Cotizaci\xF3n": cleanStr(q.quoteNumber),
    "Fecha": cleanStr(q.date),
    "Cliente / Instituci\xF3n": cleanStr(q.clientName),
    "NIT": cleanStr(q.nit),
    "Persona de Contacto": cleanStr(q.contactPerson),
    "Email Contacto": cleanStr(q.contactEmail),
    "Tel\xE9fono Contacto": cleanStr(q.contactPhone),
    "Ciudad": cleanStr(q.city || "Bogot\xE1 D.C."),
    "D\xEDas de Validez": Number(q.validityDays) || 30,
    "Forma de Pago": cleanStr(q.paymentTerms || "Contado"),
    "Tiempo de Entrega": cleanStr(q.deliveryTime || "Inmediata"),
    "Lugar de Entrega": cleanStr(q.deliveryPlace || "Instalaciones del cliente"),
    "T\xE9rminos de Garant\xEDa": cleanStr(q.warrantyTerms || "24 meses"),
    "Capacitaci\xF3n": cleanStr(q.trainingTerms || "Incluida"),
    "Asesor Comercial": cleanStr(q.advisorName || "Asesor SYD"),
    "Cargo Asesor": cleanStr(q.advisorRole || "Especialista de Producto"),
    "Email Asesor": cleanStr(q.advisorEmail),
    "Tel\xE9fono Asesor": cleanStr(q.advisorPhone),
    "Subtotal COP": Number(q.subtotal) || 0,
    "IVA COP": Number(q.iva) || 0,
    "Total COP": Number(q.total) || 0,
    "Total Equipos": Number(q.totalQuantity) || (q.items ? q.items.length : 0),
    "Estado": cleanStr(q.status || "Enviada"),
    "Observaciones": cleanStr(q.notes)
  }));
  const wsQuotes = XLSX.utils.json_to_sheet(
    quoteRows.length > 0 ? quoteRows : [{ "N\xB0 Cotizaci\xF3n": "COT-2026-001", "Fecha": (/* @__PURE__ */ new Date()).toISOString().split("T")[0], "Cliente / Instituci\xF3n": "Hospital General", "Total COP": 15e6, "Estado": "Enviada" }]
  );
  XLSX.utils.book_append_sheet(wb, wsQuotes, "2_Cotizaciones_Guardadas");
  const quoteItemRows = [];
  quotes.forEach((q) => {
    (q.items || []).forEach((it, idx) => {
      quoteItemRows.push({
        "N\xB0 Cotizaci\xF3n": cleanStr(q.quoteNumber),
        "Cliente": cleanStr(q.clientName),
        "Item #": idx + 1,
        "C\xF3digo": cleanStr(it.code),
        "Nombre del Equipo": cleanStr(it.name),
        "Marca": cleanStr(it.brand),
        "Modelo": cleanStr(it.model),
        "Cantidad": Number(it.quantity) || 1,
        "Costo Unitario COP": Number(it.unitCostCOP) || 0,
        "Margen / Factor": cleanStr(it.marginType || "L4"),
        "Multiplicador": Number(it.multiplier) || 1,
        "Precio Venta Unitario COP": Number(it.unitSalePrice) || 0,
        "Total Venta COP": Number(it.totalSalePrice) || 0,
        "Descuento %": Number(it.discountPercentage) || 0,
        "Garant\xEDa (Meses)": Number(it.warrantyMonths) || 24,
        "Accesorios / Notas": cleanStr(it.notes || (Array.isArray(it.accessories) ? it.accessories.map((a) => a.name).join(", ") : ""))
      });
    });
  });
  const wsQuoteItems = XLSX.utils.json_to_sheet(
    quoteItemRows.length > 0 ? quoteItemRows : [{ "N\xB0 Cotizaci\xF3n": "COT-2026-001", "Item #": 1, "C\xF3digo": "EQ-001", "Nombre del Equipo": "Monitor", "Cantidad": 1, "Precio Venta Unitario COP": 65e5 }]
  );
  XLSX.utils.book_append_sheet(wb, wsQuoteItems, "3_Detalle_Items_Cotizados");
  const tenderRows = tenderProjects.map((t, idx) => ({
    "ID Proyecto": t.id || `tender_${idx + 1}`,
    "Entidad / Cliente": cleanStr(t.clientName || t.header?.entityName),
    "NIT": cleanStr(t.nit || t.header?.nit),
    "N\xB0 Proceso": cleanStr(t.header?.processNumber),
    "Tipo de Proceso": cleanStr(t.header?.processType || "Licitaci\xF3n P\xFAblica"),
    "Objeto del Contrato": cleanStr(t.header?.contractObject),
    "Fecha de Apertura": cleanStr(t.header?.openingDate),
    "Fecha de Cierre": cleanStr(t.header?.closingDate),
    "Ciudad": cleanStr(t.header?.city || "Bogot\xE1 D.C."),
    "Presupuesto Oficial COP": Number(t.header?.budgetCOP) || 0,
    "Persona de Contacto": cleanStr(t.header?.contactPerson),
    "Email de Contacto": cleanStr(t.header?.contactEmail),
    "Tel\xE9fono de Contacto": cleanStr(t.header?.contactPhone),
    "Plazo de Ejecuci\xF3n": cleanStr(t.header?.executionTerm || "30 d\xEDas"),
    "Total \xCDtems": Number(t.items?.length) || 0,
    "Estado Licitaci\xF3n": cleanStr(t.status || "En Preparaci\xF3n"),
    "Fecha Creaci\xF3n": cleanStr(t.createdAt)
  }));
  const wsTenders = XLSX.utils.json_to_sheet(
    tenderRows.length > 0 ? tenderRows : [{ "ID Proyecto": "LIC-01", "Entidad / Cliente": "ESE Hospital Departamental", "N\xB0 Proceso": "SAM-001-2026", "Presupuesto Oficial COP": 5e7, "Estado Licitaci\xF3n": "En Preparaci\xF3n" }]
  );
  XLSX.utils.book_append_sheet(wb, wsTenders, "4_Licitaciones_Proyectos");
  const tenderItemRows = [];
  tenderProjects.forEach((t) => {
    (t.items || []).forEach((it, idx) => {
      tenderItemRows.push({
        "ID Proyecto": cleanStr(t.id),
        "Entidad": cleanStr(t.clientName || t.header?.entityName),
        "N\xB0 Proceso": cleanStr(t.header?.processNumber),
        "Item #": it.itemNumber || idx + 1,
        "C\xF3digo": cleanStr(it.code),
        "Nombre del Equipo": cleanStr(it.name),
        "Marca": cleanStr(it.brand),
        "Modelo": cleanStr(it.model),
        "Pa\xEDs de Origen": cleanStr(it.originCountry || "Colombia"),
        "Cantidad": Number(it.quantity) || 1,
        "Presupuesto Estimado Unitario": Number(it.unitEstimatedBudget) || 0,
        "Precio Ofertado Unitario": Number(it.offeredUnitPrice) || 0,
        "Registro INVIMA": cleanStr(it.invimaRecord),
        "Garant\xEDa (Meses)": Number(it.warrantyMonths) || 24,
        "Tiempo de Entrega (D\xEDas)": Number(it.deliveryTimeDays) || 30,
        "Cumple T\xE9cnico": "S\xCD",
        "Observaciones": cleanStr(it.observations),
        "Requisitos T\xE9cnicos": Array.isArray(it.requirements) ? it.requirements.map((r) => `[${r.complies !== false ? "CUMPLE" : "NO CUMPLE"}] ${r.requirement}${r.offeredSpec ? `: ${r.offeredSpec}` : ""}`).join(" | ") : ""
      });
    });
  });
  const wsTenderItems = XLSX.utils.json_to_sheet(
    tenderItemRows.length > 0 ? tenderItemRows : [{ "ID Proyecto": "LIC-01", "Item #": 1, "Nombre del Equipo": "Bomba de Infusi\xF3n", "Cantidad": 2, "Precio Ofertado Unitario": 32e5 }]
  );
  XLSX.utils.book_append_sheet(wb, wsTenderItems, "5_Items_Licitaciones");
  const ocRows = ocContracts.map((oc, idx) => ({
    "ID Contrato": oc.id || `oc_${idx + 1}`,
    "N\xB0 Contrato / OC": cleanStr(oc.contractNumber || oc.ocNumber || `OC-${idx + 1}`),
    "Entidad / Cliente": cleanStr(oc.clientName),
    "NIT": cleanStr(oc.nit),
    "Ciudad": cleanStr(oc.city || "Bogot\xE1 D.C."),
    "Contacto": cleanStr(oc.contactPerson),
    "Presupuesto Total COP": Number(oc.totalBudgetCOP || oc.totalCostCOP) || 0,
    "Costo Total Compra COP": Number(oc.totalCostCOP) || 0,
    "Estado Global": cleanStr(oc.globalStatus || "Borrador / Solicitud"),
    "Forma de Pago": cleanStr(oc.paymentTerms || "Cr\xE9dito 30 d\xEDas"),
    "Estado de Pago": cleanStr(oc.paymentStatus || "Pendiente"),
    "Proveedor Asignado": cleanStr(oc.supplier),
    "Total \xCDtems": Number(oc.items?.length) || 0,
    "Fecha Creaci\xF3n": cleanStr(oc.createdAt),
    "Notas": cleanStr(oc.notes)
  }));
  const wsOCs = XLSX.utils.json_to_sheet(
    ocRows.length > 0 ? ocRows : [{ "ID Contrato": "", "N\xB0 Contrato / OC": "", "Entidad / Cliente": "", "Costo Total Compra COP": "", "Estado Global": "" }]
  );
  XLSX.utils.book_append_sheet(wb, wsOCs, "6_Ordenes_Compra_OC");
  const salesOrderRows = salesOrders.map((so, idx) => ({
    "ID Orden": so.id || `ov_${idx + 1}`,
    "N\xB0 Orden de Venta": cleanStr(so.salesOrderNumber),
    "Cliente / Instituci\xF3n": cleanStr(so.clientName),
    "NIT": cleanStr(so.clientNit),
    "Ciudad": cleanStr(so.clientCity || "Bogot\xE1 D.C."),
    "Persona de Contacto": cleanStr(so.clientContactPerson),
    "Email Contacto": cleanStr(so.clientContactEmail),
    "Tel\xE9fono Contacto": cleanStr(so.clientContactPhone),
    "N\xB0 Licitaci\xF3n / Contrato": cleanStr(so.contractNumber),
    "N\xB0 Cotizaci\xF3n": cleanStr(so.quoteNumber),
    "N\xB0 Factura Emitida": cleanStr(so.invoiceNumber),
    "Fecha de Creaci\xF3n": cleanStr(so.createdAt),
    "Fecha Estimada Entrega": cleanStr(so.deliveryDate),
    "Estado Facturaci\xF3n": cleanStr(so.invoicedStatus),
    "Total Equipos": Number(so.items?.length) || 0,
    "Valor Total COP": Number(so.totalValueCOP) || 0,
    "Estado OV": cleanStr(so.status || "Borrador"),
    "Observaciones": cleanStr(so.notes)
  }));
  const wsSalesOrders = XLSX.utils.json_to_sheet(
    salesOrderRows.length > 0 ? salesOrderRows : [{ "ID Orden": "", "N\xB0 Orden de Venta": "", "Cliente / Instituci\xF3n": "", "Valor Total COP": "", "Estado OV": "" }]
  );
  XLSX.utils.book_append_sheet(wb, wsSalesOrders, "7_Ordenes_de_Venta_OV");
  const salesInvoiceRows = salesInvoices.map((inv, idx) => ({
    "ID Factura": inv.id || `fac_${idx + 1}`,
    "N\xB0 Factura": cleanStr(inv.invoiceNumber),
    "N\xB0 Orden de Venta": cleanStr(inv.salesOrderNumber),
    "Cliente / Instituci\xF3n": cleanStr(inv.clientName),
    "NIT": cleanStr(inv.clientNit),
    "Fecha Emisi\xF3n": cleanStr(inv.issueDate),
    "Fecha Vencimiento": cleanStr(inv.dueDate),
    "Subtotal COP": Number(inv.subtotalCOP) || 0,
    "IVA COP": Number(inv.taxAmountCOP) || 0,
    "Total Factura COP": Number(inv.totalAmountCOP) || 0,
    "Estado Pago Factura": cleanStr(inv.paymentStatus || "Pendiente de Pago"),
    "Fecha Radicaci\xF3n": cleanStr(inv.filingDate),
    "Fecha Pago": cleanStr(inv.paymentDate),
    "Notas / Pagos": cleanStr(inv.notes)
  }));
  const wsSalesInvoices = XLSX.utils.json_to_sheet(
    salesInvoiceRows.length > 0 ? salesInvoiceRows : [{ "ID Factura": "", "N\xB0 Factura": "", "N\xB0 Orden de Venta": "", "Cliente / Instituci\xF3n": "", "Total Factura COP": "", "Estado Pago Factura": "" }]
  );
  XLSX.utils.book_append_sheet(wb, wsSalesInvoices, "8_Facturas_Emitidas");
  const clientMap = /* @__PURE__ */ new Map();
  quotes.forEach((q) => {
    if (q.clientName) {
      clientMap.set(q.clientName.toUpperCase().trim(), {
        "Nombre Instituci\xF3n / Cliente": cleanStr(q.clientName),
        "NIT": cleanStr(q.nit),
        "Ciudad": cleanStr(q.city || "Bogot\xE1 D.C."),
        "Persona de Contacto": cleanStr(q.contactPerson),
        "Email Contacto": cleanStr(q.contactEmail),
        "Tel\xE9fono Contacto": cleanStr(q.contactPhone),
        "Origen": "Cotizaciones",
        "Notas": `Registrado en cotizaci\xF3n ${q.quoteNumber}`
      });
    }
  });
  tenderProjects.forEach((t) => {
    const name = t.clientName || t.header?.entityName;
    if (name) {
      const key = name.toUpperCase().trim();
      const existing = clientMap.get(key);
      clientMap.set(key, {
        "Nombre Instituci\xF3n / Cliente": cleanStr(name),
        "NIT": cleanStr(t.nit || t.header?.nit || existing?.["NIT"]),
        "Ciudad": cleanStr(t.header?.city || existing?.["Ciudad"] || "Bogot\xE1 D.C."),
        "Persona de Contacto": cleanStr(t.header?.contactPerson || existing?.["Persona de Contacto"]),
        "Email Contacto": cleanStr(t.header?.contactEmail || existing?.["Email Contacto"]),
        "Tel\xE9fono Contacto": cleanStr(t.header?.contactPhone || existing?.["Tel\xE9fono Contacto"]),
        "Origen": existing ? "Cotizaciones y Licitaciones" : "Licitaciones",
        "Notas": `Licitaci\xF3n ${t.header?.processNumber || ""}`
      });
    }
  });
  salesOrders.forEach((so) => {
    if (so.clientName) {
      const key = so.clientName.toUpperCase().trim();
      const existing = clientMap.get(key);
      if (!existing) {
        clientMap.set(key, {
          "Nombre Instituci\xF3n / Cliente": cleanStr(so.clientName),
          "NIT": cleanStr(so.clientNit),
          "Ciudad": cleanStr(so.clientCity || "Bogot\xE1 D.C."),
          "Persona de Contacto": cleanStr(so.clientContactPerson),
          "Email Contacto": cleanStr(so.clientContactEmail),
          "Tel\xE9fono Contacto": cleanStr(so.clientContactPhone),
          "Origen": "\xD3rdenes de Venta",
          "Notas": `Registrado en OV ${so.salesOrderNumber}`
        });
      }
    }
  });
  const clientRows = Array.from(clientMap.values());
  const wsClients = XLSX.utils.json_to_sheet(
    clientRows.length > 0 ? clientRows : [{ "Nombre Instituci\xF3n / Cliente": "Hospital Universitario", "NIT": "900123456-1", "Ciudad": "Barranquilla", "Origen": "Directorio" }]
  );
  XLSX.utils.book_append_sheet(wb, wsClients, "9_Directorio_Clientes");
  const supplierMap = /* @__PURE__ */ new Map();
  equipments.forEach((eq) => {
    const suppliers = [eq.supplier, ...eq.allSuppliers || [], ...eq.alternateSuppliers || []].filter(Boolean);
    suppliers.forEach((s) => {
      const clean = String(s).trim();
      if (clean && !supplierMap.has(clean.toUpperCase())) {
        supplierMap.set(clean.toUpperCase(), {
          "Nombre Proveedor / Fabricante": clean,
          "Marcas Distribuidas": cleanStr(eq.brand),
          "Origen de Registro": "Cat\xE1logo de Equipos",
          "Notas": `Asociado al equipo ${eq.code || eq.name}`
        });
      }
    });
  });
  const supplierRows = Array.from(supplierMap.values());
  const wsSuppliers = XLSX.utils.json_to_sheet(
    supplierRows.length > 0 ? supplierRows : [{ "Nombre Proveedor / Fabricante": "Mindray Colombia", "Marcas Distribuidas": "Mindray", "Origen de Registro": "Cat\xE1logo" }]
  );
  XLSX.utils.book_append_sheet(wb, wsSuppliers, "10_Directorio_Proveedores");
  const userRows = systemUsers.map((u) => ({
    "Usuario (Login)": cleanStr(u.username),
    "Nombre Completo": cleanStr(u.name),
    "Correo Electr\xF3nico": cleanStr(u.email),
    "Rol": u.role === "admin" ? "Administrador General" : "Asesor / Consultor",
    "Cargo / Etiqueta": cleanStr(u.roleLabel),
    "Departamento": cleanStr(u.department || "Ventas & Licitaciones")
  }));
  const wsUsers = XLSX.utils.json_to_sheet(
    userRows.length > 0 ? userRows : [{ "Usuario (Login)": "admin", "Nombre Completo": "Administrador", "Rol": "Administrador General" }]
  );
  XLSX.utils.book_append_sheet(wb, wsUsers, "11_Usuarios_Sistema");
  const metadataRows = [
    { "Propiedad": "Software", "Valor": "SYD Colombia - Software de Cotizaciones y Licitaciones" },
    { "Propiedad": "Frecuencia de Respaldo", "Valor": "Autom\xE1tico Cada Hora (Horario 24/7)" },
    { "Propiedad": "Fecha y Hora del Respaldo", "Valor": (/* @__PURE__ */ new Date()).toLocaleString("es-CO") },
    { "Propiedad": "Total Equipos en Cat\xE1logo", "Valor": equipments.length },
    { "Propiedad": "Total Cotizaciones Guardadas", "Valor": quotes.length },
    { "Propiedad": "Total Licitaciones y Proyectos", "Valor": tenderProjects.length },
    { "Propiedad": "Total \xD3rdenes de Compra (OC)", "Valor": ocContracts.length },
    { "Propiedad": "Total \xD3rdenes de Venta (OV)", "Valor": salesOrders.length },
    { "Propiedad": "Total Facturas Emitidas", "Valor": salesInvoices.length },
    { "Propiedad": "Total Documentos T\xE9cnicos", "Valor": technicalDocuments.length },
    { "Propiedad": "Total Usuarios del Sistema", "Valor": systemUsers.length }
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, "12_Resumen_Base_Datos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
async function sendHourlyBackupEmail(backupPayload, customRecipients) {
  try {
    const data = backupPayload?.data || {};
    const eqCount = backupPayload.equipmentsCount ?? data.equipments?.length ?? 0;
    const quotesCount = backupPayload.quotesCount ?? data.quotes?.length ?? 0;
    const tendersCount = backupPayload.tendersCount ?? data.tenderProjects?.length ?? 0;
    const ocCount = backupPayload.contractsCount ?? data.ocContracts?.length ?? 0;
    const salesOrdersCount = backupPayload.salesOrdersCount ?? data.salesOrders?.length ?? 0;
    const salesInvoicesCount = backupPayload.salesInvoicesCount ?? data.salesInvoices?.length ?? 0;
    const docsCount = backupPayload.documentsCount ?? data.technicalDocuments?.length ?? 0;
    const usersCount = backupPayload.usersCount ?? data.systemUsers?.length ?? 0;
    let recipients = DEFAULT_RECIPIENTS;
    if (customRecipients) {
      if (Array.isArray(customRecipients)) {
        recipients = Array.from(/* @__PURE__ */ new Set([...customRecipients.filter(Boolean), ...DEFAULT_RECIPIENTS]));
      } else if (typeof customRecipients === "string") {
        const split = customRecipients.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
        recipients = Array.from(/* @__PURE__ */ new Set([...split, ...DEFAULT_RECIPIENTS]));
      }
    }
    const now = /* @__PURE__ */ new Date();
    const dateFormatted = now.toISOString().split("T")[0];
    const timeFormatted = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const fullDateTimeStamp = `${dateFormatted}_${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}`;
    const excelFileName = `Base_de_Datos_Completa_SYD_Colombia_${fullDateTimeStamp}.xlsx`;
    const jsonFileName = `Respaldo_Integral_SYD_Colombia_${fullDateTimeStamp}.json`;
    const excelBuffer = generateExcelBuffer(backupPayload);
    const jsonString = JSON.stringify(backupPayload, null, 2);
    const jsonBuffer = Buffer.from(jsonString, "utf-8");
    let transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      const testAccount = await nodemailer.createTestAccount().catch(() => null);
      if (testAccount) {
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          jsonTransport: true
        });
      }
    }
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b1322; color: #f1f5f9; padding: 28px; border-radius: 16px; max-width: 680px; margin: 0 auto; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="color: #34d399; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
              \u{1F4CA} SYD Colombia - Respaldo Autom\xE1tico Cada Hora
            </h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">
              Generado con \xE9xito el <strong>${dateFormatted} a las ${timeFormatted}</strong>
            </p>
          </div>
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 10px; border-radius: 20px; color: #6ee7b7; font-size: 11px; font-weight: 700; text-transform: uppercase;">
            Excel .XLSX + JSON
          </div>
        </div>

        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
          Se ha generado la copia de seguridad horaria de la base de datos completa de <strong>SYD Colombia (Cotizaciones, Licitaciones SECOP II, Equipos M\xE9dicos, OCs, \xD3rdenes de Venta y Facturaci\xF3n)</strong>.
        </p>

        <!-- Metrics Grid -->
        <div style="background-color: #111e33; padding: 18px; border-radius: 12px; margin: 18px 0; border: 1px solid #1e293b;">
          <h4 style="color: #38bdf8; margin: 0 0 14px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            Resumen de Registros Respaldados:
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e2e8f0;">
            <tbody>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">\u{1F4E6} <strong>Cat\xE1logo de Equipos M\xE9dicos:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #34d399; font-weight: 700;">${eqCount} equipos</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">\u{1F4C4} <strong>Cotizaciones Guardadas:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #38bdf8; font-weight: 700;">${quotesCount} cotizaciones</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">\u{1F3DB}\uFE0F <strong>Licitaciones & Proyectos:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #c084fc; font-weight: 700;">${tendersCount} licitaciones</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">\u{1F4D1} <strong>\xD3rdenes de Compra (OC):</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #fbbf24; font-weight: 700;">${ocCount} contratos</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">\u{1F6D2} <strong>\xD3rdenes de Venta (OV):</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #2dd4bf; font-weight: 700;">${salesOrdersCount} \xF3rdenes</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">\u{1F9FE} <strong>Facturas Emitidas:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #f472b6; font-weight: 700;">${salesInvoicesCount} facturas</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">\u{1F4DA} <strong>Documentos & INVIMA:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #94a3b8; font-weight: 700;">${docsCount} archivos</td>
              </tr>
              <tr>
                <td style="padding: 8px 4px;">\u{1F465} <strong>Usuarios Registrados:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #818cf8; font-weight: 700;">${usersCount} usuarios</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Attachments Info -->
        <div style="background-color: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 14px; margin-bottom: 18px;">
          <div style="color: #6ee7b7; font-weight: 700; font-size: 13px; margin-bottom: 6px;">
            \u{1F4CE} Archivos Adjuntos a este Correo:
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #cbd5e1; line-height: 1.7;">
            <li>
              <strong style="color: #34d399;">${excelFileName}</strong>: Libro de Excel con 12 pesta\xF1as independientes (Cat\xE1logo, Cotizaciones, \xCDtems, Licitaciones, OCs, OVs, Facturas, Clientes y Proveedores) para abrir y editar en Microsoft Excel.
            </li>
            <li>
              <strong style="color: #38bdf8;">${jsonFileName}</strong>: Archivo de recuperaci\xF3n integral del sistema para restaurar la aplicaci\xF3n en un clic.
            </li>
          </ul>
        </div>

        <!-- Footer -->
        <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
          Sistema Automatizado de Respaldo Horario SYD Colombia &bull; Destinatarios: ${recipients.join(", ")}<br />
          Para soporte t\xE9cnico o restauraciones de emergencia, contacta al Administrador del Sistema.
        </div>
      </div>
    `;
    const info = await transporter.sendMail({
      from: `"SYD Colombia Respaldo" <${process.env.SMTP_USER || "backup@syd.com.co"}>`,
      to: recipients.join(", "),
      subject: `[Respaldo Horario Excel] SYD Colombia - ${dateFormatted} ${timeFormatted}`,
      text: `Respaldo Horario SYD Colombia generado el ${dateFormatted} ${timeFormatted}. Equipos: ${eqCount}, Cotizaciones: ${quotesCount}, Licitaciones: ${tendersCount}, OCs: ${ocCount}, OVs: ${salesOrdersCount}, Facturas: ${salesInvoicesCount}. Se adjunta archivo Excel y JSON.`,
      html: htmlContent,
      attachments: [
        {
          filename: excelFileName,
          content: excelBuffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        },
        {
          filename: jsonFileName,
          content: jsonBuffer,
          contentType: "application/json"
        }
      ]
    });
    console.log(`[Backup Email] Hourly backup successfully sent to ${recipients.join(", ")}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      recipients,
      time: `${dateFormatted} ${timeFormatted}`
    };
  } catch (error) {
    console.error("[Hourly Backup Email Error]:", error);
    return { success: false, error: error?.message || "Error al enviar el respaldo horario por correo" };
  }
}

// server.ts
async function startServer() {
  const app = express();
  const PORT = parseInt(
    process.env.DEFAULT_APP_PORT || (process.env.PORT && process.env.PORT !== "8080" ? process.env.PORT : "3000"),
    10
  );
  const SERVER_BOOT_TIME = Date.now();
  const APP_VERSION = "2.10.2";
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  const xlsxLib = XLSX2.default || XLSX2;
  const detectHeaderRow = (rawValues) => {
    if (!rawValues || rawValues.length === 0) {
      return { headerIdx: 0, headers: [], rows: [] };
    }
    const headerKeywords = [
      "parte",
      "codigo",
      "c\xF3digo",
      "cod",
      "descripcion",
      "descripci\xF3n",
      "nombre",
      "tipo",
      "solicitud",
      "grupo",
      "clase",
      "marca",
      "fabricante",
      "modelo",
      "referencia",
      "costo",
      "precio",
      "iva",
      "unidad",
      "medida",
      "ficha",
      "serie",
      "lote",
      "invima",
      "registro",
      "vigencia",
      "riesgo",
      "estado",
      "observac",
      "proveedor",
      "item",
      "\xEDtem",
      "categor\xEDa",
      "categoria"
    ];
    let bestHeaderIdx = -1;
    let maxScore = 0;
    for (let r = 0; r < Math.min(rawValues.length, 30); r++) {
      const row = rawValues[r] || [];
      const filledCells = row.filter((c) => c !== void 0 && c !== null && String(c).trim() !== "").length;
      if (filledCells < 2) continue;
      const rowCellsLower = row.map((c) => String(c || "").toLowerCase().trim());
      let score = 0;
      for (const cell of rowCellsLower) {
        if (headerKeywords.some((kw) => cell === kw || cell.includes(kw))) {
          score += 1;
        }
      }
      if (score > maxScore && score >= 2 && r < rawValues.length - 1) {
        maxScore = score;
        bestHeaderIdx = r;
      }
    }
    if (bestHeaderIdx === -1) {
      for (let r = 0; r < Math.min(rawValues.length, 12); r++) {
        const row = rawValues[r] || [];
        const filled = row.filter((c) => c !== void 0 && c !== null && String(c).trim() !== "").length;
        if (filled >= 2 && r < rawValues.length - 1) {
          bestHeaderIdx = r;
          break;
        }
      }
      if (bestHeaderIdx === -1) bestHeaderIdx = 0;
    }
    const rawHeaderRow = rawValues[bestHeaderIdx] || [];
    let maxCols = Math.max(rawHeaderRow.length, 1);
    for (let r = 0; r < rawValues.length; r++) {
      if (rawValues[r] && rawValues[r].length > maxCols) {
        maxCols = rawValues[r].length;
      }
    }
    const headers = [];
    for (let i = 0; i < maxCols; i++) {
      const val = rawHeaderRow[i];
      headers.push(val !== void 0 && val !== null && String(val).trim() ? String(val).trim() : `Columna ${i + 1}`);
    }
    let rows = rawValues.slice(bestHeaderIdx + 1).filter(
      (r) => r && r.some((c) => c !== void 0 && c !== null && String(c).trim() !== "")
    ).map((r) => {
      const cleanRow = [];
      for (let i = 0; i < maxCols; i++) {
        cleanRow.push(r[i] !== void 0 && r[i] !== null ? String(r[i]).trim() : "");
      }
      return cleanRow;
    });
    if (rows.length === 0 && rawValues.length > 0) {
      rows = rawValues.filter(
        (r) => r && r.some((c) => c !== void 0 && c !== null && String(c).trim() !== "")
      ).map((r) => {
        const cleanRow = [];
        for (let i = 0; i < maxCols; i++) {
          cleanRow.push(r[i] !== void 0 && r[i] !== null ? String(r[i]).trim() : "");
        }
        return cleanRow;
      });
    }
    return { headerIdx: bestHeaderIdx, headers, rows };
  };
  const fetchGoogleDriveBinary = async (fileId, token, isNativeSheet = false) => {
    try {
      const url = isNativeSheet ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet&supportsAllDrives=true` : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
      const manualRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "manual"
      });
      if (manualRes.status >= 300 && manualRes.status < 400) {
        const redirectUrl = manualRes.headers.get("location");
        if (redirectUrl) {
          try {
            const authRes = await fetch(redirectUrl, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (authRes.ok) {
              const ab = await authRes.arrayBuffer();
              return Buffer.from(ab);
            }
          } catch (_) {
          }
          try {
            const noAuthRes = await fetch(redirectUrl);
            if (noAuthRes.ok) {
              const ab = await noAuthRes.arrayBuffer();
              return Buffer.from(ab);
            }
          } catch (_) {
          }
        }
      } else if (manualRes.ok) {
        const ab = await manualRes.arrayBuffer();
        return Buffer.from(ab);
      }
      const followRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow"
      });
      if (followRes.ok) {
        const ab = await followRes.arrayBuffer();
        return Buffer.from(ab);
      }
    } catch (e) {
      console.warn("fetchGoogleDriveBinary error:", e);
    }
    return null;
  };
  const getMasterCatalogWorkbook = () => {
    const candidates = [
      path.join(process.cwd(), "data/Catalogo_Maestro_Equipos_Medicos_SYD.xlsx"),
      path.join(process.cwd(), "public/Catalogo_Maestro_Equipos_Medicos_SYD.xlsx"),
      path.join(process.cwd(), "public/database/Catalogo_Maestro_Equipos_Medicos_SYD.xlsx")
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const workbook = xlsxLib.readFile(candidate, { cellDates: true });
          return { workbook, filePath: candidate };
        } catch (e) {
          console.warn("Error reading workbook candidate:", candidate, e);
        }
      }
    }
    return null;
  };
  const APPENDED_ROWS_FILE = path.join(process.cwd(), "data/appended_sheet_rows.json");
  const getAppendedRows = (key) => {
    try {
      if (fs.existsSync(APPENDED_ROWS_FILE)) {
        const data = JSON.parse(fs.readFileSync(APPENDED_ROWS_FILE, "utf-8"));
        return data[key] || [];
      }
    } catch (_) {
    }
    return [];
  };
  const saveAppendedRow = (key, row) => {
    try {
      let data = {};
      if (fs.existsSync(APPENDED_ROWS_FILE)) {
        try {
          data = JSON.parse(fs.readFileSync(APPENDED_ROWS_FILE, "utf-8"));
        } catch (_) {
        }
      }
      if (!data[key]) data[key] = [];
      data[key].push(row);
      fs.mkdirSync(path.dirname(APPENDED_ROWS_FILE), { recursive: true });
      fs.writeFileSync(APPENDED_ROWS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.warn("Could not persist appended row to file:", e);
    }
  };
  app.post("/api/sheets/fetch-sheet", async (req, res) => {
    try {
      const { urlOrId, sheetTab, token } = req.body || {};
      const targetStr = (urlOrId || "").trim();
      const isMasterCatalog = !targetStr || targetStr === "catalogo_maestro" || targetStr === "default" || targetStr.toLowerCase().includes("catalogo_maestro") || targetStr.toLowerCase().includes("syd");
      if (isMasterCatalog) {
        const master = getMasterCatalogWorkbook();
        if (master) {
          const { workbook } = master;
          const sheetNames = workbook.SheetNames || [];
          const effectiveSheet = sheetTab && sheetNames.includes(sheetTab) ? sheetTab : sheetNames[0] || "Hoja 1";
          const worksheet = workbook.Sheets[effectiveSheet];
          let rawData = [];
          if (worksheet) {
            rawData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
          }
          const appendedKey = `catalogo_maestro_${effectiveSheet}`;
          const customAppended = getAppendedRows(appendedKey);
          if (customAppended.length > 0) {
            rawData = [...rawData, ...customAppended];
          }
          const { headers, rows } = detectHeaderRow(rawData);
          return res.json({
            success: true,
            id: "catalogo_maestro",
            title: "Cat\xE1logo Maestro Equipos M\xE9dicos SYD (Excel)",
            sheetNames,
            currentSheet: effectiveSheet,
            headers,
            rows,
            rawValues: rawData,
            totalRows: rows.length,
            isExcelFile: true,
            source: "local_master_catalog"
          });
        }
      }
      let spreadsheetId = targetStr;
      const sheetUrlMatch = targetStr.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetUrlMatch) {
        spreadsheetId = sheetUrlMatch[1];
      }
      if (token && spreadsheetId) {
        try {
          const driveMetaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (driveMetaRes.ok) {
            const driveMeta = await driveMetaRes.json();
            const fileName = driveMeta.name || "";
            const mimeType = driveMeta.mimeType || "";
            const isNativeSheet = mimeType === "application/vnd.google-apps.spreadsheet";
            const isExcel = !isNativeSheet || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel" || fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls");
            const downloaded = await fetchGoogleDriveBinary(spreadsheetId, token, isNativeSheet);
            if (downloaded) {
              const workbook = xlsxLib.read(downloaded, { type: "buffer", cellDates: true });
              const sheetNames = workbook.SheetNames || [];
              const effectiveSheet = sheetTab && sheetNames.includes(sheetTab) ? sheetTab : sheetNames[0] || "Hoja 1";
              const worksheet = workbook.Sheets[effectiveSheet];
              let rawData = [];
              if (worksheet) {
                rawData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
              }
              const appendedKey = `${spreadsheetId}_${effectiveSheet}`;
              const customAppended = getAppendedRows(appendedKey);
              if (customAppended.length > 0) {
                rawData = [...rawData, ...customAppended];
              }
              const { headers, rows } = detectHeaderRow(rawData);
              return res.json({
                success: true,
                id: spreadsheetId,
                title: fileName || (isNativeSheet ? "Hoja de Google Sheets" : "Archivo Excel Conectado"),
                sheetNames,
                currentSheet: effectiveSheet,
                headers,
                rows,
                rawValues: rawData,
                totalRows: rows.length,
                isExcelFile: !isNativeSheet,
                source: isNativeSheet ? "google_drive_export_xlsx" : "google_drive_media_xlsx",
                webViewLink: driveMeta.webViewLink || `https://drive.google.com/file/d/${spreadsheetId}/view`
              });
            }
          }
        } catch (driveErr) {
          console.warn("Drive metadata / media check failed, trying Sheets API:", driveErr);
        }
        try {
          const metaRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            const title = metaData.properties?.title || "Hoja de Google Sheets";
            const sheetNames = (metaData.sheets || []).map((s) => s.properties?.title || "").filter(Boolean);
            const effectiveSheet = sheetTab && sheetNames.includes(sheetTab) ? sheetTab : sheetNames[0] || "";
            const range = effectiveSheet ? `'${effectiveSheet.replace(/'/g, "''")}'!A1:ZZ500` : "A1:ZZ500";
            const valRes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (valRes.ok) {
              const valData = await valRes.json();
              let rawValues = (valData.values || []).map(
                (row) => (row || []).map((cell) => cell !== void 0 && cell !== null ? String(cell).trim() : "")
              );
              const appendedKey = `${spreadsheetId}_${effectiveSheet}`;
              const customAppended = getAppendedRows(appendedKey);
              if (customAppended.length > 0) {
                rawValues = [...rawValues, ...customAppended];
              }
              const { headers, rows } = detectHeaderRow(rawValues);
              return res.json({
                success: true,
                id: spreadsheetId,
                title,
                sheetNames,
                currentSheet: effectiveSheet,
                headers,
                rows,
                rawValues,
                totalRows: rows.length,
                isExcelFile: false,
                source: "google_sheets_api"
              });
            }
          }
        } catch (apiErr) {
          console.warn("Google Sheets API failed, falling back to public export or gviz:", apiErr);
        }
      }
      if (spreadsheetId) {
        try {
          const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
          const exportRes = await fetch(exportUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            redirect: "follow"
          });
          const contentType = exportRes.headers.get("content-type") || "";
          if (exportRes.ok && !contentType.includes("text/html")) {
            const arrayBuffer = await exportRes.arrayBuffer();
            const workbook = xlsxLib.read(Buffer.from(arrayBuffer), { type: "buffer", cellDates: true });
            const sheetNames = workbook.SheetNames || [];
            const effectiveSheet = sheetTab && sheetNames.includes(sheetTab) ? sheetTab : sheetNames[0] || "Hoja 1";
            const worksheet = workbook.Sheets[effectiveSheet];
            let rawData = [];
            if (worksheet) {
              rawData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
            }
            const appendedKey = `${spreadsheetId}_${effectiveSheet}`;
            const customAppended = getAppendedRows(appendedKey);
            if (customAppended.length > 0) {
              rawData = [...rawData, ...customAppended];
            }
            const { headers, rows } = detectHeaderRow(rawData);
            return res.json({
              success: true,
              id: spreadsheetId,
              title: `Hoja de Google Sheets (${spreadsheetId.substring(0, 8)}...)`,
              sheetNames,
              currentSheet: effectiveSheet,
              headers,
              rows,
              rawValues: rawData,
              totalRows: rows.length,
              isExcelFile: false,
              source: "public_export_xlsx"
            });
          }
        } catch (exportErr) {
          console.warn("Export XLSX failed, trying gviz endpoint:", exportErr);
        }
        try {
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${sheetTab ? `&sheet=${encodeURIComponent(sheetTab)}` : ""}`;
          const gvizRes = await fetch(gvizUrl, { redirect: "follow" });
          if (gvizRes.ok) {
            const csvText = await gvizRes.text();
            if (csvText && !csvText.includes("<!DOCTYPE html>")) {
              const workbook = xlsxLib.read(csvText, { type: "string" });
              const sheetNames = workbook.SheetNames || [sheetTab || "Hoja 1"];
              const effectiveSheet = sheetNames[0];
              const worksheet = workbook.Sheets[effectiveSheet];
              let rawData = [];
              if (worksheet) {
                rawData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
              }
              const appendedKey = `${spreadsheetId}_${effectiveSheet}`;
              const customAppended = getAppendedRows(appendedKey);
              if (customAppended.length > 0) {
                rawData = [...rawData, ...customAppended];
              }
              const { headers, rows } = detectHeaderRow(rawData);
              return res.json({
                success: true,
                id: spreadsheetId,
                title: `Hoja de Google Sheets (${spreadsheetId.substring(0, 8)}...)`,
                sheetNames: [sheetTab || "Hoja 1"],
                currentSheet: sheetTab || "Hoja 1",
                headers,
                rows,
                rawValues: rawData,
                totalRows: rows.length,
                isExcelFile: false,
                source: "public_gviz_csv"
              });
            }
          }
        } catch (gvizErr) {
          console.warn("Gviz fallback failed:", gvizErr);
        }
      }
      return res.status(404).json({
        success: false,
        error: "No se pudo leer el archivo o la hoja de Google Sheets solicitada desde Google Drive. Verifique que la cuenta de Google tenga permisos de lectura o que el enlace est\xE9 compartido."
      });
    } catch (err) {
      console.error("Error in /api/sheets/fetch-sheet:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Error al procesar la hoja de c\xE1lculo."
      });
    }
  });
  app.post("/api/drive/search-nfco03", async (req, res) => {
    try {
      const { token } = req.body || {};
      if (!token) {
        return res.status(401).json({
          success: false,
          error: "Debe conectar su cuenta de Google Workspace para buscar en Google Drive."
        });
      }
      if (token.startsWith("direct_")) {
        return res.json({
          success: true,
          bestMatch: null,
          matches: [],
          totalFound: 0,
          isDirectMode: true,
          message: "Modo de acceso directo activo. Puede cargar el archivo Excel (.xlsx) directamente o conectar v\xEDa OAuth oficial."
        });
      }
      const searchQueries = [
        "name contains 'N-FCO-03' and trashed=false",
        "name contains 'SOLICITUD DE CREACI' and trashed=false",
        "name contains 'PARTES VR00' and trashed=false",
        "(name contains 'INACTIVACION' or name contains 'INACTIVACI\xD3N') and trashed=false",
        "(mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.google-apps.spreadsheet') and trashed=false"
      ];
      const foundFilesMap = /* @__PURE__ */ new Map();
      for (const q of searchQueries) {
        try {
          const driveRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&pageSize=50&orderBy=modifiedTime desc`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (driveRes.ok) {
            const data = await driveRes.json();
            const files = data.files || [];
            for (const f of files) {
              foundFilesMap.set(f.id, f);
            }
          } else if (driveRes.status === 401 || driveRes.status === 403) {
            console.warn("Google Drive search returned status:", driveRes.status);
          }
        } catch (_) {
        }
      }
      const allFiles = Array.from(foundFilesMap.values());
      const cleanNormalize = (str) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const targetExact = "n-fco-03 solicitud de creacion, modificacion e inactivacion de partes vr00 en revision";
      const scored = allFiles.map((f) => {
        const normName = cleanNormalize(f.name);
        let score = 0;
        if (normName.includes("n-fco-03")) score += 50;
        if (normName.includes("n-fco")) score += 20;
        if (normName.includes("solicitud")) score += 15;
        if (normName.includes("partes")) score += 15;
        if (normName.includes("vr00")) score += 15;
        if (normName.includes("creacion")) score += 10;
        if (normName.includes("inactivacion")) score += 10;
        if (normName.includes("revision")) score += 10;
        if (normName.startsWith(targetExact) || normName === `${targetExact}.xlsx`) score += 100;
        return { ...f, score };
      });
      scored.sort((a, b) => b.score - a.score || (b.modifiedTime || "").localeCompare(a.modifiedTime || ""));
      const bestMatch = scored.length > 0 && scored[0].score >= 30 ? scored[0] : null;
      return res.json({
        success: true,
        bestMatch,
        matches: scored.filter((s) => s.score > 0),
        totalFound: allFiles.length
      });
    } catch (err) {
      console.error("Error in /api/drive/search-nfco03:", err);
      return res.json({
        success: true,
        bestMatch: null,
        matches: [],
        totalFound: 0,
        warning: err?.message || "No se pudieron consultar archivos en Google Drive."
      });
    }
  });
  app.post("/api/sheets/append-row", async (_req, res) => {
    return res.status(403).json({
      success: false,
      error: "Modo de Solo Consulta activado: la modificaci\xF3n y escritura sobre archivos de Google Drive est\xE1 deshabilitada para proteger la integridad de sus archivos."
    });
  });
  app.get(["/api/version", "/api/app-version"], (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({
      bootTime: SERVER_BOOT_TIME,
      version: APP_VERSION,
      timestamp: Date.now(),
      status: "active"
    });
  });
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  };
  const generateWithModelFallback = async (ai, prompt, preferredModel = "gemini-3.8-flash") => {
    const modelsToTry = [preferredModel, "gemini-3.1-flash-lite", "gemini-flash-latest"];
    const uniqueModels = Array.from(new Set(modelsToTry));
    let lastError = null;
    for (let i = 0; i < uniqueModels.length; i++) {
      const modelName = uniqueModels[i];
      try {
        const config = {
          responseMimeType: "application/json"
        };
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config
        });
        if (response.text) {
          return response.text;
        }
      } catch (err) {
        lastError = err;
        if (i < uniqueModels.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }
    throw lastError || new Error("All model attempts failed");
  };
  app.post("/api/gemini/optimize-spec", async (req, res) => {
    try {
      const { specText, equipmentName, brand, model } = req.body;
      if (!specText || typeof specText !== "string") {
        return res.status(400).json({ error: "specText is required" });
      }
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(200).json({
          fallback: true,
          message: "Server Gemini client not configured, using local rule-based optimizer"
        });
      }
      const prompt = `Eres un Ingeniero Biom\xE9dico experto en contrataci\xF3n p\xFAblica hospitalaria (SECOP II) y estructuraci\xF3n de pliegos t\xE9cnicos de equipos m\xE9dicos en Colombia para SYD Colombia.
Tu tarea es analizar, corregir y profesionalizar la siguiente especificaci\xF3n t\xE9cnica ingresada por el usuario.

Contexto del Equipo:
- Equipo: ${equipmentName || "Equipo Biom\xE9dico Hospitalario"}
- Marca: ${brand || "No especificada"}
- Modelo: ${model || "No especificado"}

Texto original ingresado por el usuario:
"${specText}"

Instrucciones:
1. Corrige ortograf\xEDa, sintaxis y unidades de medida (ej: mmHg, cmH2O, lpm/bpm, Hz, Joules, L/min, MHz, Watts, ml, \xB0C, kg, cm, mm, pulgadas, etc.).
2. REGLA ESTRICTA DE DETECCI\xD3N DE PAR\xC1METROS NUM\xC9RICOS (isParametricSpec):
   - Solo se considera par\xE1metro con rango si el texto CONTIENE PAR\xC1METROS F\xCDSICOS CONTINUOS MEDIBLES con unidades de ingenier\xEDa biom\xE9dica (ej: "pantalla 12.1 pulgadas", "frecuencia 50 a 100 lpm", "altura 60 cm", "presion 120/80 mmHg", "volumen 1500 ml", "bater\xEDa 4 horas", "energ\xEDa 360 Joules", "potencia 300 Watts", etc.).
   - PROHIBIDO GENERAR RANGO PARA EST\xC1NDARES, PROTOCOLOS, ALGORITMOS O CONTEOS DISCRETOS:
     * Textos que mencionen HL7, DICOM, IEC 60601, ISO 13485, IPX1, USB, RS232, Wi-Fi, VGA, HDMI, etc. NO son rangos num\xE9ricos.
     * Textos como "m\xE1s de 20 tipos de arritmias", "an\xE1lisis del segmento ST", "hasta 8 curvas simult\xE1neas", "cable de 3 a 5 derivadas", "12 derivaciones", "software en espa\xF1ol", "registro INVIMA", etc. son ESPECIFICACIONES CUALITATIVAS / DE FUNCIONALIDAD, NO par\xE1metros con rangos.
     * En todos estos casos debes responder obligatoriamente: "isParametricSpec": false, "paramName": null, "detectedWorkRange": null, "rangeVersion": null, "rangeVariants": null.
   - SI CONTIENE PAR\xC1METROS F\xCDSICOS MEDIBLES REALES:
     * "isParametricSpec": true
     * "paramName": Nombre del par\xE1metro (ej: "Tama\xF1o de Pantalla", "Frecuencia Card\xEDaca", "Cambio de Altura / Elevaci\xF3n", "Presi\xF3n Arterial NIBP", "Medidas y Dimensiones", "Volumen Corriente", "Autonom\xEDa de Bater\xEDa", etc.)
     * REGLA CR\xCDTICA DE RANGOS AMPLIOS: Los rangos de valores deben ser holgados, amplios y comercialmente realistas para pliegos de licitaci\xF3n, NUNCA rangos estrechos o milim\xE9tricos (como "12 a 12.2" o "12.0 a 12.2" que restringen indebidamente la licitaci\xF3n):
       - Pantallas: Si el valor original es ~12.1", el rango debe ser AMPLIO, ej: "10 a 12.1 pulgadas" o "10 a 13 pulgadas" (NUNCA 12 a 12.2). Si es 15", "12 a 15 pulgadas" o "12 a 17 pulgadas". Si es 8.4" o 7", "7 a 10.4 pulgadas".
       - Bater\xEDas: Para 4 horas -> "2 a 5 horas" o "m\xEDnimo 3 horas".
       - Frecuencia card\xEDaca: "15 a 300 lpm".
       - Presi\xF3n NIBP: "10 a 270 mmHg".
       - Volumen Corriente (Vt): "10 a 1500 ml" o "20 a 1200 ml".
       - Flujo de gases: "0.1 a 15 L/min".
       - Energ\xEDa desfibrilador: "1 a 360 Joules".
       - Potencia electrobistur\xED: "10 a 300 Watts".
       - Peso: Para equipo de 3.5 kg -> "2.5 a 4.5 kg".
     * "detectedWorkRange": Formular SIEMPRE como un INTERVALO/RANGO de valores amplio (ej: "10 a 12.1 pulgadas", "10 a 13 pulgadas", "15 a 300 lpm", "10 a 270 mmHg", "2 a 5 horas"). NO uses frases unilaterales como "no inferior a" en el campo de rango.
     * "rangeVersion": Redacci\xF3n t\xE9cnica formal que incorpore expl\xEDcitamente el rango de valores de tipo "entre [Min] a [Max] [Unidad]" (ej: "Pantalla m\xE9dica t\xE1ctil a color con visualizaci\xF3n diagonal entre 10 a 12.1 pulgadas de alta definici\xF3n con curvas simult\xE1neas...", "Rango de trabajo de frecuencia card\xEDaca continuo entre 15 a 300 lpm con resoluci\xF3n de 1 lpm...").
     * "rangeVariants": Objeto con 4 variantes: "between" (entre Min a Max amplio), "min" (m\xEDnimo Min hasta Max), "max" (m\xE1ximo hasta Max), "fixed" (de [Valor] [Unidad] / valor nominal sin rangos).

3. Genera las 2 versiones de redacci\xF3n:
   - "optimized": Versi\xF3n t\xE9cnica profesional mejorada y clara con rango "entre" amplio si es param\xE9trica.
   - "formal": Versi\xF3n estrictamente formal para pliegos de contrataci\xF3n hospitalaria.

Devuelve EXCLUSIVAMENTE un objeto JSON v\xE1lido con este formato:
{
  "optimized": "texto mejorado con rango entre amplio",
  "formal": "texto formal",
  "isParametricSpec": true,
  "paramName": "Tama\xF1o de Pantalla",
  "detectedWorkRange": "10 a 12.1 pulgadas",
  "rangeVersion": "Pantalla m\xE9dica t\xE1ctil a color con tama\xF1o diagonal entre 10 a 12.1 pulgadas con visualizaci\xF3n de curvas simult\xE1neas.",
  "rangeVariants": {
    "between": "Pantalla m\xE9dica t\xE1ctil a color con tama\xF1o diagonal entre 10 a 12.1 pulgadas.",
    "min": "Pantalla m\xE9dica t\xE1ctil a color con tama\xF1o diagonal m\xEDnimo 10 pulgadas.",
    "max": "Pantalla m\xE9dica t\xE1ctil a color con tama\xF1o diagonal m\xE1ximo hasta 13 pulgadas.",
    "fixed": "Pantalla m\xE9dica t\xE1ctil a color con tama\xF1o diagonal de 12.1 pulgadas."
  }
}`;
      let responseText = "{}";
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn("Gemini models temporarily unavailable, using graceful local fallback response:", geminiError);
        return res.status(200).json({
          fallback: true,
          message: "Gemini service temporarily at capacity, switching to local biomedical engine"
        });
      }
      const parsedData = JSON.parse(responseText);
      return res.json({
        success: true,
        data: parsedData
      });
    } catch (err) {
      console.warn("Handling optimization request with local fallback:", err?.message || err);
      return res.status(200).json({
        fallback: true,
        message: err.message || "Error processing AI technical specification"
      });
    }
  });
  app.post("/api/gemini/generate-equipment-specs", async (req, res) => {
    try {
      const { equipmentName, brand, model, categoryFocus, customPrompt, count } = req.body;
      if (!equipmentName) {
        return res.status(400).json({ error: "equipmentName is required" });
      }
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(200).json({
          fallback: true,
          message: "Server Gemini client not configured, using local rule generator"
        });
      }
      let focusInstructions = "";
      if (customPrompt && customPrompt.trim()) {
        focusInstructions = `
REQUERIMIENTO O ENFOQUE ESPEC\xCDFICO DEL USUARIO:
"${customPrompt.trim()}"
Genera especificaciones t\xE9cnicas altamente especializadas y precisas alineadas con esta instrucci\xF3n.`;
      } else if (categoryFocus) {
        if (categoryFocus === "ranges") {
          focusInstructions = "\nENFOQUE OBLIGATORIO: Genera especificaciones t\xE9cnicas centradas en PAR\xC1METROS NUM\xC9RICOS, RANGOS DE TRABAJO HOLGADOS Y MEDICIONES BIOM\xC9DICAS (ej: pantalla, presiones, frecuencias, volumen, bater\xEDa, potencias, etc.).";
        } else if (categoryFocus === "shielding") {
          focusInstructions = "\nENFOQUE OBLIGATORIO: Genera especificaciones t\xE9cnicas de BLINDAJE TECNOL\xD3GICO, funciones exclusivas, algoritmos avanzados, patentes y diferenciadores de alta tecnolog\xEDa para el equipo.";
        } else if (categoryFocus === "connectivity") {
          focusInstructions = "\nENFOQUE OBLIGATORIO: Genera especificaciones t\xE9cnicas de CONECTIVIDAD, SOFTWARE, PROTOCOLOS (HL7, DICOM, HIS/RIS), SEGURIDAD EL\xC9CTRICA (IEC 60601), INVIMA Y NORMATIVIDAD.";
        } else if (categoryFocus === "accessories") {
          focusInstructions = "\nENFOQUE OBLIGATORIO: Genera especificaciones t\xE9cnicas de ACCESORIOS EST\xC1NDAR, SUMINISTROS, CONSUMIBLES Y M\xD3DULOS DE EXPANSI\xD3N.";
        }
      }
      const specQuantity = count && Number(count) > 0 ? Number(count) : 8;
      const prompt = `Eres un Ingeniero Biom\xE9dico senior especialista en licitaciones hospitalarias en Colombia (SECOP II) y fichas t\xE9cnicas m\xE9dicas para la empresa SYD Colombia.
Analiza la tecnolog\xEDa m\xE9dica del siguiente equipo:
- Nombre de Equipo: ${equipmentName}
- Marca: ${brand || "SYD Colombia / Mindray / General"}
- Modelo: ${model || "Est\xE1ndar Hospitalario"}
${focusInstructions}

Instrucciones de redacci\xF3n t\xE9cnica:
1. Genera entre ${Math.max(4, specQuantity - 2)} y ${specQuantity} especificaciones t\xE9cnicas formales redactadas profesionalmente para pliego licitatorio.
2. REGLA ESTRICTA: NO INCLUYAS s\xEDmbolos de estrellas (ni \u2B50, ni \u2605, ni asteriscos) en ning\xFAn texto ni en los requerimientos.
3. REGLA DE RANGOS AMPLIOS PARA ESPECIFICACIONES CON VALORES NUM\xC9RICOS:
   - Solo para especificaciones que involucren par\xE1metros medibles o valores num\xE9ricos (ej: frecuencia card\xEDaca, NIBP, SpO2, temperatura, volumen tidal, presiones PEEP, flujo de gases medicinales, tama\xF1o de pantalla, autonom\xEDa de bater\xEDa, potencia en Watts, energ\xEDa en Joules, tasa de infusi\xF3n, etc.), debes indicar "hasWorkRange": true, y un "workRange" AMPLIO y HOLGADO.
   - NUNCA generes rangos estrechos, cerrados o milim\xE9tricos (como "12 a 12.2", "12.0 a 12.2" o "3.9 a 4.1").
   - Ejemplos de rangos amplios aprobados:
     * Tama\xF1o de pantalla para equipo de ~12.1": workRange "10 a 12.1 pulgadas" o "10 a 13 pulgadas" (between: "Pantalla m\xE9dica t\xE1ctil a color con tama\xF1o diagonal entre 10 a 12.1 pulgadas de alta definici\xF3n...", fixed: "Pantalla m\xE9dica t\xE1ctil a color con tama\xF1o diagonal de 12.1 pulgadas").
     * Tama\xF1o de pantalla para equipo de 15": "12 a 15 pulgadas" o "12 a 17 pulgadas".
     * Frecuencia card\xEDaca: "15 a 300 lpm".
     * Presi\xF3n no invasiva NIBP: "10 a 270 mmHg".
     * Saturaci\xF3n SpO2: "0 a 100%".
     * Temperatura: "0.0 a 50.0 \xB0C".
     * Bater\xEDa: "2 a 5 horas" o "m\xEDnimo 3 horas".
     * Volumen corriente Vt: "10 a 1500 ml" o "20 a 1200 ml".
     * Suministro de gases: "0.1 a 15 L/min".
     * Energ\xEDa de desfibrilaci\xF3n: "1 a 360 Joules".
     * Potencia electrobistur\xED: "10 a 300 Watts".
   - Variantes de redacci\xF3n a generar en cada especificaci\xF3n num\xE9rica:
     * "between": redacci\xF3n con rango amplio "entre [min] a [max] [unidad]"
     * "min": redacci\xF3n con exigencia de m\xEDnimo "m\xEDnimo [min] [unidad] hasta [max] [unidad]"
     * "max": redacci\xF3n con l\xEDmite superior "m\xE1ximo hasta [max] [unidad]"
     * "fixed": redacci\xF3n con valor nominal definido "de [max] [unit]" (sin rangos)
4. PARA ESPECIFICACIONES CUALITATIVAS, DE SOFTWARE, ALGORITMOS O EST\xC1NDARES:
   - Casos como compatibilidad HL7/DICOM, an\xE1lisis de arritmias, an\xE1lisis del segmento ST, visualizaci\xF3n de curvas, derivaciones, software en espa\xF1ol, alarmas seg\xFAn IEC 60601, grado de protecci\xF3n IPX, manuales de usuario y certificaciones:
   - Deben tener OBLIGATORIAMENTE "hasWorkRange": false, "workRange": null y sin variantes num\xE9ricas ni rangos artificiales.
5. Marca 1 o 2 especificaciones como "isUnique": true si corresponden a caracter\xEDsticas diferenciales de alto nivel.
6. Sugiere una lista de 4 a 6 "optionalAccessories" adicionales.

Devuelve EXCLUSIVAMENTE un objeto JSON v\xE1lido con esta estructura exacta:
{
  "specs": [
    {
      "requirement": "Pantalla m\xE9dica t\xE1ctil LED a color de alta definici\xF3n con tama\xF1o diagonal entre 10 a 12.1 pulgadas con visualizaci\xF3n de hasta 8 curvas simult\xE1neas.",
      "isUnique": false,
      "hasWorkRange": true,
      "workRange": "10 a 12.1 pulgadas",
      "rangeVariants": {
        "between": "Pantalla m\xE9dica t\xE1ctil a color con visualizaci\xF3n diagonal entre 10 a 12.1 pulgadas.",
        "min": "Pantalla m\xE9dica t\xE1ctil a color con visualizaci\xF3n diagonal m\xEDnimo de 10 pulgadas.",
        "max": "Pantalla m\xE9dica t\xE1ctil a color con visualizaci\xF3n diagonal hasta 13 pulgadas.",
        "fixed": "Pantalla m\xE9dica t\xE1ctil a color con visualizaci\xF3n diagonal de 12.1 pulgadas."
      }
    },
    {
      "requirement": "Rango de trabajo de medici\xF3n continua de frecuencia card\xEDaca de 15 a 300 lpm con resoluci\xF3n de 1 lpm y alarmas programables.",
      "isUnique": false,
      "hasWorkRange": true,
      "workRange": "15 a 300 lpm",
      "rangeVariants": {
        "between": "Rango de trabajo de frecuencia card\xEDaca continuo entre 15 a 300 lpm con resoluci\xF3n de 1 lpm.",
        "min": "Capacidad de frecuencia card\xEDaca de m\xEDnimo 15 lpm hasta 300 lpm con alarmas programables.",
        "max": "Frecuencia card\xEDaca con l\xEDmite superior de m\xE1ximo hasta 300 lpm.",
        "fixed": "Medici\xF3n de frecuencia card\xEDaca continua con capacidad nominal de 300 lpm."
      }
    },
    {
      "requirement": "Interconectividad con sistema de informaci\xF3n hospitalaria (HIS/RIS) y central de monitoreo mediante protocolo est\xE1ndar HL7 y DICOM.",
      "isUnique": false,
      "hasWorkRange": false,
      "workRange": null
    }
  ],
  "optionalAccessories": [
    "Carrito de transporte rodable con frenos y bandeja porta-accesorios",
    "Brazo articulado de soporte a pared con giro de 180\xB0",
    "M\xF3dulo adicional de Capnograf\xEDa (EtCO2 microstream)",
    "M\xF3dulo de Presi\xF3n Invasiva (IBP) de 2 canales",
    "Impresora / Registrador t\xE9rmico incorporado de 3 canales",
    "Bater\xEDa adicional de Iones de Litio de larga duraci\xF3n"
  ]
}`;
      let responseText = "{}";
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn("Gemini specs capacity fallback triggered:", geminiError?.message || geminiError);
        return res.status(200).json({
          fallback: true,
          message: "Gemini service temporarily at capacity, switching to local rules"
        });
      }
      const parsedData = JSON.parse(responseText);
      return res.json({
        success: true,
        data: parsedData
      });
    } catch (err) {
      console.warn("Handling equipment specs request with fallback:", err?.message || err);
      return res.status(200).json({
        fallback: true,
        message: err.message || "Error generating specs"
      });
    }
  });
  app.post("/api/gemini/research-equipment-sheet", async (req, res) => {
    try {
      const { equipmentName, brand, model } = req.body;
      if (!equipmentName || typeof equipmentName !== "string") {
        return res.status(400).json({ error: "equipmentName is required" });
      }
      const ai = getGeminiClient();
      const trimmedName = equipmentName.trim();
      const trimmedBrand = (brand || "").trim();
      const trimmedModel = (model || "").trim();
      const getBiomedicalFallback = () => {
        const lower = trimmedName.toLowerCase();
        const isScissors = /tijera|metzembaum|metzenbaum|mayo|iris|castroviejo|potts|stevens|liston|tijeras/i.test(lower);
        const isClamp = /pinza|kelly|kocher|mosquito|allis|babcock|hemostatica|portaagujas|crile|foerster|backhaus|duval|clamp|forceps|disiseccion|disección/i.test(lower);
        const isTray = /bandeja|recipiente|rinonera|caja quirurgica|canastilla|tambor|cubeta/i.test(lower);
        const isFurniture = /camilla|cama hospitalaria|mesa de mayo|mesa pasteur|mesa quirurgica|escalerilla|vitrina|carro de paro|carro de curaciones|atril|silla de ruedas|mueble/i.test(lower);
        const isMonitoring = /monitor|signos vitales|multiparámetro|beneview|umec|epm|ipm/i.test(lower);
        const isDefib = /desfibrilador|dea|beneheart/i.test(lower);
        const isElectro = /electrobistur|electrocirug|bovie/i.test(lower);
        const isVentilator = /ventilador|respirador|sv300|synovent/i.test(lower);
        const isInfusion = /bomba|infusion|infusor|jeringa|benefusion/i.test(lower);
        const isUltrasound = /ecograf|ultrasonid|transductor/i.test(lower);
        const isLight = /lampara|cielitica|quirurgica|frontoluz/i.test(lower);
        const isSuction = /suctor|aspirador|secreciones/i.test(lower);
        const isECG = /electrocardiog|ecg|ekg/i.test(lower);
        let desc = `Dispositivo biom\xE9dico hospitalario de alta calidad y precisi\xF3n dise\xF1ado para soporte asistencial y cl\xEDnico conforme a normativas ISO 13485 e INVIMA.`;
        let characteristics = [
          "Fabricaci\xF3n con materiales de grado m\xE9dico de alta pureza y resistencia.",
          "Dise\xF1o ergon\xF3mico optimizado para procedimientos asistenciales y cl\xEDnicos seguros.",
          "Superficies higi\xE9nicas no porosas de f\xE1cil limpieza y desinfecci\xF3n hospitalaria.",
          "Resistencia superior a la corrosi\xF3n, agentes desinfectantes y uso intensivo.",
          "Bordes y acabados de seguridad para eliminar acumulaci\xF3n de agentes pat\xF3genos."
        ];
        let func = `Brindar soporte cl\xEDnico, asistencial o quir\xFArgico seguro y confiable en los servicios asistenciales de la instituci\xF3n.`;
        let mat = "Acero Inoxidable ASIS 420/316 para uso en dispositivos quir\xFArgicos y hospitalarios de alta calidad.";
        let invima = `2024DM-${Math.floor(1e6 + Math.random() * 9e6).toString().substring(0, 7)}`;
        let area = "SERVICIOS QUIR\xDARGICOS Y ASISTENCIALES";
        let sterilization = "El producto se suministra NO EST\xC9RIL. Debe someterse a protocolo de lavado con detergente enzim\xE1tico y posterior esterilizaci\xF3n por vapor en autoclave a 134\xB0C.";
        let storage = "Almacenar en lugar limpio, fresco y seco (15\xB0C a 25\xB0C), humedad relativa menor al 65%, protegido del polvo y luz solar directa.";
        let warranty = "5 a\xF1os contra defectos de fabricaci\xF3n en acero quir\xFArgico.";
        let variants = [
          { code: trimmedModel ? `${trimmedModel}-01` : "REF-01", size: "Est\xE1ndar", dimensions: "Configuraci\xF3n est\xE1ndar", description: "Uso cl\xEDnico habitual" },
          { code: trimmedModel ? `${trimmedModel}-02` : "REF-02", size: "Especializada", dimensions: "Configuraci\xF3n reforzada", description: "Alta demanda" }
        ];
        if (isScissors) {
          const isMetz = /metzembaum|metzenbaum/i.test(lower);
          const isMayo = /mayo/i.test(lower);
          const scissorType = isMetz ? "Metzenbaum" : isMayo ? "Mayo" : "Quir\xFArgica";
          desc = `Tijera ${scissorType} de alta precisi\xF3n dise\xF1ada con ramas finas y hojas curvas o rectas con puntas romas de seguridad, ideal para la disecci\xF3n roma delicada y el corte atraum\xE1tico de tejidos biol\xF3gicos blandos en profundidad anat\xF3mica.`;
          characteristics = [
            "Hojas afiladas de alta precisi\xF3n con filo biselado continuo para corte limpio y sin desgarros tisulares.",
            "Puntas romas atraum\xE1ticas para disecci\xF3n roma segura evitando la perforaci\xF3n accidental de vasos o v\xEDsceras.",
            "Fabricaci\xF3n en Acero Inoxidable Martens\xEDtico Alem\xE1n (AISI 420 / 440A) templado t\xE9rmicamente para m\xE1xima dureza.",
            "Articulaci\xF3n con tornillo central rectificado de precisi\xF3n que garantiza un deslizamiento suave y sin holguras.",
            "Anillas ergon\xF3micas redondeadas con amplio di\xE1metro para un agarre c\xF3modo y control milim\xE9trico del cirujano.",
            "Alta resistencia qu\xEDmica a desinfectantes enzim\xE1ticos y esterilizaci\xF3n en autoclave a 134\xB0C, OE y plasma."
          ];
          func = "Disecci\xF3n roma y secci\xF3n precisa y atraum\xE1tica de tejidos blandos, planos profundos y estructuras delicadas en intervenciones quir\xFArgicas.";
          mat = "Acero Inoxidable Martens\xEDtico Alem\xE1n de grado quir\xFArgico AISI 420 / DIN 1.4021 con tratamiento t\xE9rmico de endurecimiento.";
          area = "QUIR\xD3FANO, CIRUG\xCDA GENERAL Y CENTRAL DE ESTERILIZACI\xD3N";
          sterilization = "Suministrado NO EST\xC9RIL. Lavado ultras\xF3nico o manual con detergente enzim\xE1tico neutro y esterilizaci\xF3n en autoclave a 134\xB0C por 5 a 18 minutos.";
          warranty = "5 a\xF1os contra defectos de fabricaci\xF3n y fatiga prematura del material.";
          variants = [
            { code: "14.5 cm (Curva)", size: '14.5 cm (5-3/4")', dimensions: "Longitud: 14.5 cm, Curva", description: "Disecci\xF3n fina superficial" },
            { code: "18.0 cm (Curva)", size: '18 cm (7")', dimensions: "Longitud: 18 cm, Curva", description: "Est\xE1ndar de cirug\xEDa general" },
            { code: "20.0 cm (Curva)", size: '20 cm (8")', dimensions: "Longitud: 20 cm, Curva", description: "Disecci\xF3n profunda de tejidos" },
            { code: "23.0 cm (Curva)", size: '23 cm (9")', dimensions: "Longitud: 23 cm, Curva", description: "Cirug\xEDa p\xE9lvica / tor\xE1cica profunda" },
            { code: "18.0 cm (Recta)", size: '18 cm (7")', dimensions: "Longitud: 18 cm, Recta", description: "Corte de suturas y tejidos superficiales" }
          ];
        } else if (isClamp) {
          desc = `Instrumental quir\xFArgico hemost\xE1tico de prensi\xF3n de alta confiabilidad con estr\xEDas transversales y sistema de cremallera de m\xFAltiples posiciones para hemostasia y sujeci\xF3n firme.`;
          characteristics = [
            "Ramas estilizadas con mand\xEDbulas dentadas transversales para sujeci\xF3n atraum\xE1tica pero firme de vasos.",
            "Sistema de trinquete / cremallera de 3 a 5 pasos para bloqueo y fijaci\xF3n gradual de presi\xF3n.",
            "Acero inoxidable de grado quir\xFArgico AISI 410 / 420 con acabado satinado antirreflejo bajo luz cial\xEDtica.",
            "Resistencia superior a la fatiga el\xE1stica en ciclos continuos de apertura y cierre.",
            "Esterilizable por calor h\xFAmedo en autoclave a 134\xB0C, calor seco y \xF3xido de etileno."
          ];
          func = "Oclusi\xF3n hemost\xE1tica de vasos sangu\xEDneos, sujeci\xF3n firme de tejidos o fijaci\xF3n de campos quir\xFArgicos.";
          mat = "Acero Inoxidable de grado quir\xFArgico AISI 420/410 templado.";
          area = "QUIR\xD3FANO Y CENTRAL DE ESTERILIZACI\xD3N";
          sterilization = "Suministrado NO EST\xC9RIL. Desinfecci\xF3n enzim\xE1tica y esterilizaci\xF3n en autoclave a 134\xB0C con cremallera abierta.";
          warranty = "5 a\xF1os contra defectos de fabricaci\xF3n.";
          variants = [
            { code: "14.0 cm (Curva)", size: '14 cm (5-1/2")', dimensions: "Longitud: 14 cm, Curva", description: "Hemostasia delicada" },
            { code: "14.0 cm (Recta)", size: '14 cm (5-1/2")', dimensions: "Longitud: 14 cm, Recta", description: "Tracci\xF3n y hemostasia superficial" },
            { code: "16.0 cm (Curva)", size: '16 cm (6-1/4")', dimensions: "Longitud: 16 cm, Curva", description: "Cirug\xEDa general y planos medios" },
            { code: "18.5 cm (Curva)", size: '18.5 cm (7-1/4")', dimensions: "Longitud: 18.5 cm, Curva", description: "Hemostasia profunda" }
          ];
        } else if (isTray) {
          desc = `Dispositivo e instrumental quir\xFArgico de alta durabilidad, dise\xF1ado para la contenci\xF3n, organizaci\xF3n, transporte y esterilizaci\xF3n segura de instrumental en sala de operaciones y central de esterilizaci\xF3n.`;
          characteristics = [
            "Fabricado en Acero Inoxidable ASIS 420/316 de grado quir\xFArgico de alta pureza.",
            "Acabado superficial sanitario no poroso, resistente a picaduras y corrosi\xF3n.",
            "Bordes romos perimetrales y esquinas redondeadas para evitar atrapamiento de residuos y proteger envolturas est\xE9riles.",
            "Excelente tolerancia t\xE9rmica a ciclos repetitivos de esterilizaci\xF3n en autoclave (hasta 134\xB0C) y calor seco.",
            "Alta resistencia mec\xE1nica a la flexi\xF3n, deformaciones y agentes qu\xEDmicos desinfectantes enzim\xE1ticos."
          ];
          func = "Soporte, disposici\xF3n organizada, transporte y esterilizaci\xF3n de instrumental y material quir\xFArgico durante actos operatorios y en central de esterilizaci\xF3n.";
          mat = "Acero Inoxidable ASIS 420/316 para uso en fabricaci\xF3n de implantes y dispositivos quir\xFArgicos, que cumple con los requisitos de seguridad, eficacia y calidad.";
          area = "CENTRAL DE ESTERILIZACI\xD3N Y QUIR\xD3FANO";
          sterilization = "El producto se suministra NO EST\xC9RIL y debe ser sometido a protocolo de lavado con detergente enzim\xE1tico neutro y posterior esterilizaci\xF3n por vapor en autoclave a 134\xB0C (o calor seco).";
          warranty = "5 a\xF1os contra defectos de fabricaci\xF3n o fallas estructurales de material.";
          variants = [
            { code: "35 x 25 x 1 cm", size: '13-3/4" x 9-3/4" x 1/2"', dimensions: "35 x 25 x 1 cm", description: "Bandeja plana para instrumental menor" },
            { code: "38 x 26.5 x 2 cm", size: '15" x 10-1/2" x 3/4"', dimensions: "38 x 26.5 x 2 cm", description: "Bandeja plana para cirug\xEDa general" },
            { code: "43 x 29.5 x 1 cm", size: '17" x 11-5/8" x 1/2"', dimensions: "43 x 29.5 x 1 cm", description: "Bandeja plana para instrumental mayor" }
          ];
        } else if (isFurniture) {
          desc = `Mobiliario hospitalario de alta resistencia y dise\xF1o ergon\xF3mico, concebido para brindar m\xE1xima seguridad, higiene, estabilidad y confort en \xE1reas de hospitalizaci\xF3n, consulta o quir\xF3fano.`;
          characteristics = [
            "Estructura tubular robusta en acero de alto calibre con recubrimiento en pintura electrost\xE1tica epoxi-poli\xE9ster horneada.",
            "Superficies y planos de apoyo lisos, libres de aristas vivas, dise\xF1ados para limpieza y desinfecci\xF3n r\xE1pida.",
            'Ruedas de grado hospitalario de giro suave de 3" a 5" con freno individual y banda de poliuretano antihuella.',
            "Capacidad de carga est\xE1tica y din\xE1mica superior probada bajo est\xE1ndares de seguridad hospitalaria.",
            "Resistente a soluciones antis\xE9pticas, alcoholes, hipoclorito diluido y detergentes institucionales."
          ];
          func = "Facilitar el traslado, soporte, descanso y posicionamiento seguro del paciente y del instrumental m\xE9dico durante la atenci\xF3n cl\xEDnica.";
          mat = "Estructura met\xE1lica en acero laminado en fr\xEDo / acero inoxidable AISI 304 con acabados de grado hospitalario.";
          area = "HOSPITALIZACI\xD3N, URGENCIAS, QUIR\xD3FANO Y CONSULTA EXTERNA";
          sterilization = "Limpieza y desinfecci\xF3n de superficies con pa\xF1os humedecidos en soluci\xF3n de amonio cuaternario o hipoclorito de sodio al 0.5%. No sumergir.";
          warranty = "3 a\xF1os de garant\xEDa estructural por defectos de fabricaci\xF3n.";
          variants = [
            { code: "190 x 60 x 80 cm", size: "Configuraci\xF3n Est\xE1ndar", dimensions: "190 x 60 x 80 cm", description: "Dimensiones reglamentarias de uso hospitalario general" },
            { code: "200 x 75 x 85 cm", size: "Configuraci\xF3n Reforzada", dimensions: "200 x 75 x 85 cm", description: "Alta capacidad de carga y uso bari\xE1trico" }
          ];
        } else if (isMonitoring) {
          desc = `Monitor multipar\xE1metro de alta fidelidad para la monitorizaci\xF3n continua y en tiempo real de los signos vitales del paciente, con pantalla t\xE1ctil de alta definici\xF3n y alarmas configurables.`;
          characteristics = [
            "Visualizaci\xF3n simult\xE1nea multicanal de curvas fisiol\xF3gicas (ECG, SpO2, Resp, NIBP, Temperatura, IBP).",
            "Algoritmo avanzado de detecci\xF3n de arritmias y an\xE1lisis del segmento ST en tiempo real.",
            "Alarmas audiovisuales graduables por severidad conforme a la norma IEC 60601-1-8.",
            "Bater\xEDa recargable integrada de iones de litio con autonom\xEDa superior a 4 horas.",
            "Puertos de conectividad est\xE1ndar USB, Ethernet y compatibilidad con protocolo HL7/HIS.",
            "Carcasa con protecci\xF3n IPX1 contra goteo vertical y materiales resistentes a desinfectantes."
          ];
          func = "Monitorizaci\xF3n continua y no invasiva de variables fisiol\xF3gicas cr\xEDticas del paciente en estado agudo o postoperatorio.";
          mat = "Estructura externa en pol\xEDmero ABS de grado m\xE9dico ign\xEDfugo de alto impacto y blindaje electromagn\xE9tico interno.";
          area = "UNIDAD DE CUIDADOS INTENSIVOS (UCI), URGENCIAS Y RECUPERACI\xD3N";
          sterilization = "Limpieza de superficies con pa\xF1o suave humedecido con amonio cuaternario o alcohol isoprop\xEDlico al 70%. Sensores esterilizables seg\xFAn especificaci\xF3n.";
          warranty = "2 a\xF1os de garant\xEDa total del equipo con soporte t\xE9cnico, repuestos y calibraci\xF3n metrol\xF3gica.";
          variants = [
            { code: trimmedModel ? `${trimmedModel}-10` : "uMEC-10", size: 'Pantalla 10.4"', dimensions: "27 x 17 x 24 cm", description: "Monitor para hospitalizaci\xF3n y transporte" },
            { code: trimmedModel ? `${trimmedModel}-12` : "uMEC-12", size: 'Pantalla 12.1"', dimensions: "31 x 18 x 29 cm", description: "Monitor para cuidados intermedios y UCI" }
          ];
        } else if (isDefib) {
          desc = `Desfibrilador / monitor bif\xE1sico port\xE1til para reanimaci\xF3n cardiopulmonar, desfibrilaci\xF3n manual, DEA y monitorizaci\xF3n de constantes vitales en situaciones de emergencia.`;
          characteristics = [
            "Tecnolog\xEDa de onda bif\xE1sica truncada exponencial (BTE) con compensaci\xF3n de impedancia transtor\xE1cica.",
            "Modos de operaci\xF3n: Manual, DEA y Marcapasos no invasivo transcut\xE1neo.",
            "Tiempo de carga ultra-r\xE1pido menor a 5 segundos para 200 Joules.",
            "Pantalla a color de alta visibilidad para curvas de ECG y energ\xEDa seleccionada.",
            "Autotest diario autom\xE1tico con indicador visual de operatividad del equipo.",
            "Palas externas multifunci\xF3n adulto/pedi\xE1trico integradas con selector de carga."
          ];
          func = "Reanimaci\xF3n cardiopulmonar mediante descarga el\xE9ctrica controlada y monitorizaci\xF3n electrocardiogr\xE1fica en parada cardiorrespiratoria.";
          mat = "Pol\xEDmero de alta resistencia mec\xE1nica a impactos, sellado contra fluidos y polvo (IP44).";
          area = "URGENCIAS, UCI, CIRUG\xCDA Y AMBULANCIAS DE SOPORTE VITAL";
          sterilization = "Desinfecci\xF3n de carcasa y palas con toallas con alcohol al 70% o soluci\xF3n desinfectante hospitalaria neutra.";
          warranty = "3 a\xF1os de garant\xEDa en unidad principal y 1 a\xF1o en bater\xEDa y accesorios reusables.";
        } else if (isElectro) {
          desc = `Unidad electroquir\xFArgica de alta frecuencia para corte puro, corte mixto y coagulaci\xF3n monopolar y bipolar en cirug\xEDa especializada.`;
          characteristics = [
            "Sistema digital de retroalimentaci\xF3n de impedancia tisular para potencia constante.",
            "Monitoreo continuo de electrodo de retorno del paciente (sistema REM / CQM).",
            "Modos de corte puro, blend, coagulaci\xF3n por contacto y coagulaci\xF3n fulguraci\xF3n (spray).",
            "Salidas monopolares y bipolares con activaci\xF3n independiente por l\xE1piz o pedal.",
            "Compatibilidad con instrumentos laparosc\xF3picos y pinzas bipolares est\xE1ndar."
          ];
          func = "Secci\xF3n y hemostasia de tejidos biol\xF3gicos mediante corrientes el\xE9ctricas de alta frecuencia durante intervenciones quir\xFArgicas.";
          mat = "Chasis met\xE1lico con pintura electrost\xE1tica y panel frontal en policarbonato m\xE9dico impermeable sellado.";
          area = "QUIR\xD3FANOS Y SALAS DE CIRUG\xCDA AMBULATORIA";
          sterilization = "Limpieza de consola con pa\xF1o humedecido con desinfectante no corrosivo. Accesorios esterilizables en autoclave.";
          warranty = "2 a\xF1os de garant\xEDa con soporte t\xE9cnico y verificaci\xF3n metrol\xF3gica anual.";
        } else if (isVentilator) {
          desc = `Ventilador pulmonar mec\xE1nico de cuidados intensivos dise\xF1ado para brindar soporte ventilatorio invasivo y no invasivo en pacientes adultos, pedi\xE1tricos y neonatales.`;
          characteristics = [
            "Turbina de alto rendimiento integrada que elimina la necesidad de compresor de aire externo.",
            "Modos ventilatorios avanzados: VCV, PCV, PRVC, PSV, SIMV, CPAP/BiPAP y ventilaci\xF3n no invasiva (VNI).",
            "Compensaci\xF3n autom\xE1tica de fugas y resistencia de tubo endotraqueal.",
            'Pantalla t\xE1ctil a color de 12.1" con despliegue de bucles din\xE1micos presi\xF3n-volumen y flujo-volumen.',
            "Bater\xEDa interna recargable de respaldo con autonom\xEDa hasta de 6 horas continuas.",
            "V\xE1lvula espiratoria autoclavable integrada para prevenci\xF3n efectiva de infecciones cruzadas."
          ];
          func = "Soporte vital y asistencia respiratoria mec\xE1nica continua en insuficiencia respiratoria aguda y postoperatorio.";
          mat = "Chasis en aleaci\xF3n de aluminio y pol\xEDmeros m\xE9dicos antibacteriales con grado de protecci\xF3n IP21.";
          area = "UNIDAD DE CUIDADOS INTENSIVOS (UCI) ADULTOS, PEDI\xC1TRICA Y URGENCIAS";
          sterilization = "V\xE1lvula espiratoria esterilizable en autoclave a 134\xB0C. Sensores y superficies limpiables con pa\xF1os desinfectantes.";
          warranty = "2 a\xF1os de garant\xEDa de f\xE1brica con calibraci\xF3n metrol\xF3gica y soporte t\xE9cnico nacional.";
        } else if (isInfusion) {
          desc = `Bomba de infusi\xF3n volum\xE9trica digital inteligente para la administraci\xF3n precisa, continua y controlada de fluidos intravenosos, medicamentos y nutrici\xF3n parenteral.`;
          characteristics = [
            "Mecanismo de bombeo perist\xE1ltico lineal de alta precisi\xF3n con error volum\xE9trico inferior a \xB15%.",
            "Biblioteca de f\xE1rmacos preinstalada con l\xEDmites de dosificaci\xF3n de seguridad (Dose Error Reduction System).",
            "Detecci\xF3n ultras\xF3nica de burbujas de aire en l\xEDnea y sensor de oclusi\xF3n aguas arriba y abajo regulable.",
            "Pantalla LCD retroiluminada a color con visualizaci\xF3n de tasa (ml/h), volumen infundido y tiempo restante.",
            "Bater\xEDa de litio integrada con autonom\xEDa superior a 8 horas a velocidad est\xE1ndar.",
            "Dise\xF1o modular apilable que permite interconexi\xF3n r\xE1pida en torre de infusi\xF3n."
          ];
          func = "Administraci\xF3n exacta y segura de medicamentos cr\xEDticos, anest\xE9sicos, fluidos y soporte nutricional intravascular.";
          mat = "Carcasa pl\xE1stica m\xE9dica de alta resistencia con protecci\xF3n IP34 contra salpicaduras de l\xEDquidos.";
          area = "HOSPITALIZACI\xD3N, UCI, CIRUG\xCDA, PEDIATR\xCDA Y ONCOLOG\xCDA";
          sterilization = "Desinfecci\xF3n superficial con toallas con amonios cuaternarios de quinta generaci\xF3n o alcohol al 70%.";
          warranty = "2 a\xF1os de garant\xEDa con servicio de calibraci\xF3n volum\xE9trica anual certificado.";
        } else if (isUltrasound) {
          desc = `Sistema de ultrasonido diagn\xF3stico digital port\xE1til de alta definici\xF3n para exploraci\xF3n ecogr\xE1fica multidisciplinaria en tiempo real.`;
          characteristics = [
            "Procesamiento digital de haz multifrecuencia con reducci\xF3n de ruido speckle y arm\xF3nicas de tejido.",
            "Modos de imagen: B, 2B, 4B, M, Doppler Color, Doppler Pulsado (PW), Doppler Poder y Doppler Tisular.",
            "Pantalla LED m\xE9dica de alta resoluci\xF3n antirreflejo de 15 pulgadas con inclinaci\xF3n ajustable.",
            "Compatibilidad con transductores convexos, lineales, endocavitarios y microconvexos.",
            "Disco duro de estado s\xF3lido interno con exportaci\xF3n DICOM 3.0 para PACS hospitalario.",
            "Encendido ultra-r\xE1pido menor a 25 segundos y bater\xEDa integrada de respaldo."
          ];
          func = "Evaluaci\xF3n diagn\xF3stica no invasiva de \xF3rganos internos, flujo vascular y estructuras anat\xF3micas en tiempo real.";
          mat = "Estructura ultraligera de magnesio-aluminio con recubrimiento de pol\xEDmeros sellados.";
          area = "IM\xC1GENES DIAGN\xD3STICAS, GINECOLOG\xCDA, RADIOLOG\xCDA, URGENCIAS Y UCI";
          sterilization = "Transductores desinfectables con toallitas de alto nivel no alcoh\xF3licas o glutaraldeh\xEDdo seg\xFAn protocolo.";
          warranty = "2 a\xF1os en consola y 1 a\xF1o en transductores diagn\xF3sticos.";
        }
        return {
          description: desc,
          characteristics,
          function: func,
          material: mat,
          invimaRecordNumber: invima,
          hospitalArea: area,
          sterilization,
          storage,
          warranty,
          variants
        };
      };
      if (!ai) {
        return res.json({
          success: true,
          source: "local_biomedical_engine",
          data: getBiomedicalFallback()
        });
      }
      const prompt = `Eres un Ingeniero Biom\xE9dico senior especialista en equipos m\xE9dicos hospitalarios, instrumental quir\xFArgico, mobiliario cl\xEDnico, dispositivos m\xE9dicos e INVIMA para estructuraci\xF3n de fichas t\xE9cnicas oficiales.
Investiga en internet las especificaciones reales, manuales t\xE9cnicos y fichas t\xE9cnicas oficiales del fabricante para el siguiente equipo o dispositivo:
- Nombre del Producto / Equipo: "${trimmedName}"
- Marca: "${trimmedBrand || "Fabricante Biom\xE9dico"}"
- Modelo o Referencia: "${trimmedModel || "Est\xE1ndar"}"

Objetivo: Obtener la informaci\xF3n t\xE9cnica ver\xEDdica, concisa, profesional y completa para elaborar la Ficha T\xE9cnica Oficial del producto en Colombia.

INSTRUCCI\xD3N DE RETORNO OBLIGATORIA:
Devuelve EXCLUSIVAMENTE un JSON v\xE1lido (sin explicaciones ni markdown envolvente fuera del JSON) con los siguientes campos:
{
  "description": "Descripci\xF3n t\xE9cnica clara, concisa y profesional del equipo/dispositivo (1 a 2 p\xE1rrafos cortos). Explica qu\xE9 es, su principio de operaci\xF3n y su prop\xF3sito cl\xEDnico/quir\xFArgico.",
  "characteristics": [
    "5 a 8 caracter\xEDsticas t\xE9cnicas clave del equipo (materiales, resistencia, normas internacionales IEC/ISO, interfaces, precisi\xF3n, etc.)"
  ],
  "function": "Funci\xF3n principal directa en quir\xF3fano, \xE1reas asistenciales o central de esterilizaci\xF3n.",
  "material": "Material exacto de fabricaci\xF3n certificado (ej: Acero Inoxidable ASIS 420/316, Pol\xEDmero ABS de grado m\xE9dico ign\xEDfugo, Titanio quir\xFArgico, etc.).",
  "invimaRecordNumber": "Registro Sanitario INVIMA sugerido o formato oficial colombiano (ej: 2024DM-0012345 o INVIMA 2021DM-0023456).",
  "hospitalArea": "\xC1rea hospitalaria o central recomendada (ej: CENTRAL DE ESTERILIZACI\xD3N Y QUIR\xD3FANO, UCI ADULTOS Y PEDI\xC1TRICA, URGENCIAS, etc.).",
  "sterilization": "Protocolo de esterilizaci\xF3n o desinfecci\xF3n recomendado detallado.",
  "storage": "Condiciones de almacenamiento recomendadas (temperatura, humedad, empaque).",
  "warranty": "Garant\xEDa est\xE1ndar (ej: 5 a\xF1os contra defectos de fabricaci\xF3n / 2 a\xF1os con soporte t\xE9cnico oficial).",
  "variants": [
    { "code": "Medida o dimensi\xF3n f\xEDsica real de la pieza (ej: 30 cm (Recta), 30 cm (Curva), 28 cm, 32 cm, etc.). REGLA VITAL: Genera entre 4 y 8 variantes o medidas hospitalarias/quir\xFArgicas. Si el nombre, descripci\xF3n o modelo contiene una medida (ej: 30 cm o 14.5 cm), INCLUYE esa medida exacta con variantes Recta y Curva, y AGREGA m\xE1s medidas complementarias del rango cl\xEDnico est\xE1ndar (ej: 24 cm, 26 cm, 28 cm, 32 cm, 35 cm o variaciones con garra/sin garra)", "size": "Tama\xF1o / Longitud en cm y pulgadas", "dimensions": "Longitud y forma (ej: Longitud: 30 cm, Curva)", "description": "Aplicaci\xF3n cl\xEDnica espec\xEDfica de cada medida" }
  ]
}`;
      try {
        let rawText = "";
        let sourceUsed = "gemini_web_search";
        const withTimeout = (promise, ms = 6e3) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("AI Request timeout")), ms))
          ]);
        };
        try {
          const response = await withTimeout(ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }]
            }
          }), 7e3);
          rawText = response.text || "";
        } catch (_groundingErr) {
          try {
            const fallbackResponse = await withTimeout(ai.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: prompt
            }), 5e3);
            rawText = fallbackResponse.text || "";
            sourceUsed = "gemini_ai_knowledge";
          } catch (_modelErr) {
            return res.json({
              success: true,
              source: "local_biomedical_engine",
              data: getBiomedicalFallback()
            });
          }
        }
        if (rawText) {
          const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return res.json({
            success: true,
            source: sourceUsed,
            data: parsed
          });
        }
        return res.json({
          success: true,
          source: "local_biomedical_fallback",
          data: getBiomedicalFallback()
        });
      } catch (_overallErr) {
        return res.json({
          success: true,
          source: "local_biomedical_fallback",
          data: getBiomedicalFallback()
        });
      }
    } catch (err) {
      console.error("Unexpected error in /api/gemini/research-equipment-sheet:", err?.message || err);
      res.status(500).json({ error: err.message || "Error researching equipment" });
    }
  });
  const CURATED_BIOMEDICAL_IMAGES = [
    // Pinzas Quirúrgicas Atraumáticas - BABCOCK
    {
      keywords: ["pinza", "babcock"],
      title: "Pinza Babcock Quir\xFArgica Atraum\xE1tica (16 cm / 18 cm / 20 cm)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Babcock.JPG/500px-Babcock.JPG",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Babcock.JPG/500px-Babcock.JPG",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "babcock"],
      title: "Pinza Babcock Intestinal y Ginecol\xF3gica Mand\xEDbula Fenestrada Atraum\xE1tica",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Babcock%282%29.jpg/500px-Babcock%282%29.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Babcock%282%29.jpg/500px-Babcock%282%29.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Pinzas de Tracción Tisular - ALLIS
    {
      keywords: ["pinza", "allis"],
      title: "Pinza Allis de Tracci\xF3n Tisular con Dientes de Agarre Fino",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Allis-Coakley_Tonsil_Forceps_of_Dr._John_Hersel_Gladney_-_DPLA_-_a4261f0460f3b9818d9c53cdbf9b647d_%28page_1%29.jpg/500px-Allis-Coakley_Tonsil_Forceps_of_Dr._John_Hersel_Gladney_-_DPLA_-_a4261f0460f3b9818d9c53cdbf9b647d_%28page_1%29.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Allis-Coakley_Tonsil_Forceps_of_Dr._John_Hersel_Gladney_-_DPLA_-_a4261f0460f3b9818d9c53cdbf9b647d_%28page_1%29.jpg/500px-Allis-Coakley_Tonsil_Forceps_of_Dr._John_Hersel_Gladney_-_DPLA_-_a4261f0460f3b9818d9c53cdbf9b647d_%28page_1%29.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Pinza Backhaus (de Campo)
    {
      keywords: ["pinza", "backhaus", "campo"],
      title: "Pinza Backhaus de Primer Campo Quir\xFArgico",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Backhaus_clamp.svg/500px-Backhaus_clamp.svg.png",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Backhaus_clamp.svg/500px-Backhaus_clamp.svg.png",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Pinzas de Disección Quirúrgica
    {
      keywords: ["pinza", "diseccion", "sin garra"],
      title: "Pinza de Disecci\xF3n Quir\xFArgica Est\xE1ndar Sin Garra (Acero Quir\xFArgico)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Medical_instrument_Plain_dissecting_forceps.jpg/500px-Medical_instrument_Plain_dissecting_forceps.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Medical_instrument_Plain_dissecting_forceps.jpg/500px-Medical_instrument_Plain_dissecting_forceps.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "diseccion", "sin garra"],
      title: "Pinza DeBakey Vascular Atrauma Sin Garra (14.5 cm / 20 cm)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Debakey_forceps.jpg/500px-Debakey_forceps.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Debakey_forceps.jpg/500px-Debakey_forceps.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "diseccion", "sin garra"],
      title: "Pinza Adson Anat\xF3mica Tisular Sin Dientes",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "diseccion", "con garra"],
      title: "Pinza de Disecci\xF3n Quir\xFArgica Con Garra 1x2 Dientes (Dientes de Rat\xF3n)",
      url: "https://lanrdistribuciones.com/wp-content/uploads/2023/02/PINZA-DE-DISECCION-ESTANDAR-CON-GARRA.-LONGITUD-14.5.jpg",
      thumbnail: "https://lanrdistribuciones.com/wp-content/uploads/2023/02/PINZA-DE-DISECCION-ESTANDAR-CON-GARRA.-LONGITUD-14.5.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "diseccion", "con garra"],
      title: "Pinza Adson Quir\xFArgica Con Garra 1x2 Dientes para Sutura",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "diseccion"],
      title: "Pinza de Disecci\xF3n Quir\xFArgica Est\xE1ndar en Acero Inoxidable",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Forceps.jpg/500px-Forceps.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Forceps.jpg/500px-Forceps.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "adson"],
      title: "Pinza Adson Quir\xFArgica (Micro-disecci\xF3n Tisular)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "debakey"],
      title: "Pinza DeBakey Vascular Atrauma",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Debakey_forceps.jpg/500px-Debakey_forceps.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Debakey_forceps.jpg/500px-Debakey_forceps.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Pinzas Hemostáticas (Kelly, Crile, Mosquito, Kocher)
    {
      keywords: ["pinza", "kelly"],
      title: "Pinza Hemost\xE1tica Kelly Curva y Recta (14 cm / 16 cm)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "crile"],
      title: "Pinza Hemost\xE1tica Crile Curva y Recta",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "mosquito", "halsted"],
      title: "Pinza Halsted Mosquito Micro-hemost\xE1tica (12.5 cm)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "kocher"],
      title: "Pinza Kocher Hemost\xE1tica con Dientes de Tracci\xF3n",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Pinza_kocher.jpg/500px-Pinza_kocher.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Pinza_kocher.jpg/500px-Pinza_kocher.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "magill"],
      title: "Pinza Magill para Intubaci\xF3n Endotraqueal",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Magill_forceps_open.jpg/500px-Magill_forceps_open.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Magill_forceps_open.jpg/500px-Magill_forceps_open.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["pinza", "hemostatica"],
      title: "Pinzas Hemost\xE1ticas Quir\xFArgicas Variadas (Set de Quir\xF3fano)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Porta Agujas
    {
      keywords: ["porta", "aguja", "hegar"],
      title: "Porta Agujas Mayo-Hegar Quir\xFArgico",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/EB1911_Surgical_Instruments_-_Needle-holders.jpg/500px-EB1911_Surgical_Instruments_-_Needle-holders.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/EB1911_Surgical_Instruments_-_Needle-holders.jpg/500px-EB1911_Surgical_Instruments_-_Needle-holders.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Tijeras Quirúrgicas
    {
      keywords: ["tijera", "metzenbaum"],
      title: "Tijera Quir\xFArgica Metzenbaum Curva (Disecci\xF3n Tisular Profunda)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["tijera", "metzembaum"],
      title: "Tijera Metzenbaum Curva en Acero Alem\xE1n",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["tijera", "mayo"],
      title: "Tijera Quir\xFArgica Mayo Curva y Recta (Corte de Fascias y Material)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Mayo_surgical_scissors.jpg/500px-Mayo_surgical_scissors.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Mayo_surgical_scissors.jpg/500px-Mayo_surgical_scissors.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["tijera"],
      title: "Tijera Quir\xFArgica de Disecci\xF3n en Acero Inoxidable",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Mangos de Bisturí y Cuchillas
    {
      keywords: ["mango", "bisturi"],
      title: "Mango de Bistur\xED No. 3 / No. 4 con Escala Milim\xE9trica",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bisturi_Tacca_Millimetrata.jpg/500px-Bisturi_Tacca_Millimetrata.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bisturi_Tacca_Millimetrata.jpg/500px-Bisturi_Tacca_Millimetrata.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    {
      keywords: ["bisturi"],
      title: "Bistur\xED Quir\xFArgico con Hoja de Precisi\xF3n",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bisturi_Tacca_Millimetrata.jpg/500px-Bisturi_Tacca_Millimetrata.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bisturi_Tacca_Millimetrata.jpg/500px-Bisturi_Tacca_Millimetrata.jpg",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Separadores y Retractores
    {
      keywords: ["separador", "farabeuf"],
      title: "Juego de Separadores Farabeuf en Acero Inoxidable",
      url: "https://solucionesmedicas.com.gt/wp-content/uploads/2023/03/71.-Separador-de-farabeuf-1-600x600.png",
      thumbnail: "https://solucionesmedicas.com.gt/wp-content/uploads/2023/03/71.-Separador-de-farabeuf-1-600x600.png",
      source: "Instrumental Quir\xFArgico Certificado"
    },
    // Equipos Biomédicos de Quirófano y UCI
    {
      keywords: ["electrobisturi"],
      title: "Generador Electroquir\xFArgico / Electrobistur\xED Monopolar y Bipolar",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Electrosurgery.jpg/500px-Electrosurgery.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Electrosurgery.jpg/500px-Electrosurgery.jpg",
      source: "Equipos Biom\xE9dicos Hospitalarios"
    },
    {
      keywords: ["unidad", "electroquirurgica"],
      title: "Unidad Electroquir\xFArgica para Quir\xF3fano",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Electrosurgery.jpg/500px-Electrosurgery.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Electrosurgery.jpg/500px-Electrosurgery.jpg",
      source: "Equipos Biom\xE9dicos Hospitalarios"
    },
    {
      keywords: ["monitor", "signos", "vitales"],
      title: "Monitor de Signos Vitales Hospitalario con Pantalla Digital",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Hospital_Patient_Monitor_%2817239884329%29.jpg/500px-Hospital_Patient_Monitor_%2817239884329%29.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Hospital_Patient_Monitor_%2817239884329%29.jpg/500px-Hospital_Patient_Monitor_%2817239884329%29.jpg",
      source: "Equipos Biom\xE9dicos Hospitalarios"
    },
    {
      keywords: ["monitor", "multiparametros"],
      title: "Monitor Multipar\xE1metros Hospitalario (ECG, SpO2, PNI, Temp)",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Hospital_Patient_Monitor_%2817239884329%29.jpg/500px-Hospital_Patient_Monitor_%2817239884329%29.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Hospital_Patient_Monitor_%2817239884329%29.jpg/500px-Hospital_Patient_Monitor_%2817239884329%29.jpg",
      source: "Equipos Biom\xE9dicos Hospitalarios"
    },
    {
      keywords: ["desfibrilador"],
      title: "Desfibrilador Bif\xE1sico Hospitalario con Monitor y Marcapasos",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/AED_machine_medisource.jpg/500px-AED_machine_medisource.jpg",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/AED_machine_medisource.jpg/500px-AED_machine_medisource.jpg",
      source: "Equipos Biom\xE9dicos Hospitalarios"
    },
    {
      keywords: ["bomba", "infusion"],
      title: "Bomba de Infusi\xF3n Volum\xE9trica Digital Continua",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Infusionspumpe.JPG/500px-Infusionspumpe.JPG",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Infusionspumpe.JPG/500px-Infusionspumpe.JPG",
      source: "Equipos Biom\xE9dicos Hospitalarios"
    },
    {
      keywords: ["laringoscopio"],
      title: "Juego de Laringoscopio con Hojas Macintosh y Miller",
      url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Glidescope_02.JPG/500px-Glidescope_02.JPG",
      thumbnail: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Glidescope_02.JPG/500px-Glidescope_02.JPG",
      source: "Equipos Biom\xE9dicos Hospitalarios"
    }
  ];
  async function searchInternetProductImages(query) {
    const rawClean = query.replace(/[^\w\s\-\.áéíóúÁÉÍÓÚñÑ]/gi, " ").trim();
    if (!rawClean) return [];
    const cleanNorm = (str) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const lowerQuery = cleanNorm(rawClean);
    const results = [];
    const seenUrls = /* @__PURE__ */ new Set();
    const addResult = (item) => {
      const u = item.url || item.thumbnail;
      if (!u || seenUrls.has(u)) return;
      const uLower = u.toLowerCase();
      if (uLower.endsWith(".pdf") || uLower.endsWith(".djvu") || uLower.endsWith(".tif") || uLower.endsWith(".tiff") || uLower.endsWith(".webm") || uLower.endsWith(".mp4") || uLower.endsWith(".ogg") || uLower.endsWith(".ogv")) {
        return;
      }
      seenUrls.add(u);
      results.push(item);
    };
    const hasConGarra = lowerQuery.includes("con garra") || lowerQuery.includes("con dientes");
    const hasSinGarra = lowerQuery.includes("sin garra") || lowerQuery.includes("sin dientes");
    const isSeparador = lowerQuery.includes("separador") || lowerQuery.includes("retractor") || lowerQuery.includes("farabeuf");
    const PINZA_SPECIFIC_FAMILIES = [
      "babcock",
      "allis",
      "kocher",
      "adson",
      "debakey",
      "kelly",
      "crile",
      "mosquito",
      "halsted",
      "foerster",
      "backhaus",
      "pozzi",
      "tenaculo",
      "magill",
      "duval",
      "rusa",
      "russian",
      "rochester",
      "pean",
      "diseccion"
    ];
    const TIJERA_SPECIFIC_FAMILIES = [
      "metzenbaum",
      "metzembaum",
      "mayo",
      "iris",
      "potts",
      "castroviejo",
      "lister"
    ];
    const queryPinzaFamily = PINZA_SPECIFIC_FAMILIES.find((f) => lowerQuery.includes(f));
    const queryTijeraFamily = TIJERA_SPECIFIC_FAMILIES.find((f) => lowerQuery.includes(f));
    const scoredCurated = CURATED_BIOMEDICAL_IMAGES.map((entry) => {
      const entryText = cleanNorm(entry.keywords.join(" ") + " " + entry.title);
      if (isSeparador) {
        const isEntrySeparador = entry.keywords.includes("separador") || entryText.includes("separador") || entryText.includes("farabeuf");
        if (!isEntrySeparador) {
          return { entry, score: -100 };
        }
      }
      if (queryPinzaFamily) {
        const entryHasFamily = entry.keywords.includes(queryPinzaFamily) || entryText.includes(queryPinzaFamily);
        if (!entryHasFamily) {
          return { entry, score: -100 };
        }
      }
      if (queryTijeraFamily) {
        const normFamily = queryTijeraFamily === "metzembaum" ? "metzenbaum" : queryTijeraFamily;
        const entryHasFamily = entry.keywords.includes(normFamily) || entryText.includes(normFamily);
        if (!entryHasFamily) {
          return { entry, score: -100 };
        }
      }
      const entryIsSinGarra = entry.keywords.includes("sin garra") || entryText.includes("sin garra") || entryText.includes("sin dientes");
      const entryIsConGarra = entry.keywords.includes("con garra") || entryText.includes("con garra") || entryText.includes("con dientes");
      if (hasConGarra && entryIsSinGarra) return { entry, score: -100 };
      if (hasSinGarra && entryIsConGarra) return { entry, score: -100 };
      let score = 0;
      for (const rawKw of entry.keywords) {
        const kw = cleanNorm(rawKw);
        if (lowerQuery.includes(kw)) {
          if (queryPinzaFamily && kw === queryPinzaFamily) score += 30;
          else if (queryTijeraFamily && (kw === queryTijeraFamily || kw.includes("metzen"))) score += 30;
          else if (kw === "farabeuf") score += 40;
          else if (kw === "pinza" || kw === "tijera") score += 2;
          else score += 4;
        }
      }
      if (hasConGarra && entryIsConGarra) score += 15;
      if (hasSinGarra && entryIsSinGarra) score += 15;
      return { entry, score };
    }).filter((item) => item.score >= 4).sort((a, b) => b.score - a.score);
    for (const item of scoredCurated) {
      addResult({
        title: item.entry.title,
        url: item.entry.url,
        thumbnail: item.entry.thumbnail,
        source: item.entry.source
      });
    }
    const simplifiedTerms = lowerQuery.replace(/\b(daddy d pro|daddy|cm|mm|pulgadas|ref|modelo|marca)\b/gi, "").replace(/\s+/g, " ").trim();
    const NON_MEDICAL_BLACKLIST = [
      "wisconsin",
      "baseball",
      "park",
      "postoffice",
      "sign",
      "crater",
      "university",
      "ranch",
      "theatre",
      "monument",
      "portrait",
      "church",
      "iglesia",
      "rio",
      "lake",
      "valle",
      "valley",
      "building",
      "edificio",
      "calle",
      "street",
      "bridge",
      "cranberries",
      "spray",
      "plant",
      "flower",
      "station",
      "train",
      "aircraft",
      "ship",
      "cangrejo",
      "igrexa",
      "clothe",
      "spaghetti",
      "vapor",
      "engine",
      "nephropidae",
      "precios",
      "irresponsable",
      "tomo",
      "deboning",
      "fish",
      "dissertation",
      "operating room",
      "quirofano",
      "cirujano",
      "hijab",
      "piedra, papel",
      "puertas de tijera",
      "juana diaz",
      "uprising",
      "dos de mayo",
      "murcielago",
      "lamborghini",
      "egagropila",
      "opabinia",
      "tumba de kha",
      "household"
    ];
    if (results.length < 3) {
      const bestTerm = simplifiedTerms || rawClean;
      try {
        const esWikiUrl = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          bestTerm
        )}&prop=pageimages&pithumbsize=600&format=json&origin=*`;
        const esRes = await fetch(esWikiUrl, { signal: AbortSignal.timeout(2500) });
        if (esRes.ok) {
          const esData = await esRes.json();
          if (esData.query && esData.query.pages) {
            for (const pid of Object.keys(esData.query.pages)) {
              const p = esData.query.pages[pid];
              const thumb = p.thumbnail?.source;
              const titleNorm = cleanNorm(p.title || "");
              if (!thumb) continue;
              if (NON_MEDICAL_BLACKLIST.some((bl) => titleNorm.includes(bl))) continue;
              const isSpanishMedical = titleNorm.includes("pinza") || titleNorm.includes("tijera") || titleNorm.includes("separador") || titleNorm.includes("retractor") || titleNorm.includes("bisturi") || titleNorm.includes("portaagujas") || titleNorm.includes("porta agujas") || titleNorm.includes("monitor") || titleNorm.includes("desfibrilador") || titleNorm.includes("electrobisturi") || titleNorm.includes("biomedic") || titleNorm.includes("quirurgic");
              if (!isSpanishMedical) continue;
              if (queryPinzaFamily && !titleNorm.includes(queryPinzaFamily) && !titleNorm.includes("pinza")) {
                continue;
              }
              if (queryTijeraFamily) {
                const normTijera = queryTijeraFamily === "metzembaum" ? "metzenbaum" : queryTijeraFamily;
                if (!titleNorm.includes(normTijera)) continue;
              }
              if (isSeparador && !titleNorm.includes("separador") && !titleNorm.includes("farabeuf") && !titleNorm.includes("retractor")) {
                continue;
              }
              addResult({
                title: `${p.title} (Instrumental / Equipo M\xE9dico)`,
                url: thumb,
                thumbnail: thumb,
                source: "Wikipedia M\xE9dica"
              });
              if (results.length >= 8) break;
            }
          }
        }
      } catch (_esErr) {
      }
    }
    if (results.length < 8) {
      let engTerm = simplifiedTerms;
      if (lowerQuery.includes("babcock")) engTerm = "babcock forceps";
      else if (lowerQuery.includes("allis")) engTerm = "allis clamp";
      else if (lowerQuery.includes("kocher")) engTerm = "kocher forceps";
      else if (lowerQuery.includes("adson")) engTerm = "adson forceps";
      else if (lowerQuery.includes("debakey")) engTerm = "debakey forceps";
      else if (lowerQuery.includes("kelly")) engTerm = "kelly forceps";
      else if (lowerQuery.includes("crile")) engTerm = "crile forceps";
      else if (lowerQuery.includes("mosquito") || lowerQuery.includes("halsted")) engTerm = "halsted mosquito forceps";
      else if (lowerQuery.includes("foerster") || lowerQuery.includes("esponja")) engTerm = "sponge forceps";
      else if (lowerQuery.includes("backhaus") || lowerQuery.includes("campo")) engTerm = "towel clamp";
      else if (lowerQuery.includes("porta") && lowerQuery.includes("aguja")) engTerm = "needle holder";
      else if (lowerQuery.includes("pinza") && lowerQuery.includes("diseccion")) engTerm = "dissecting forceps";
      else if (lowerQuery.includes("pinza") && lowerQuery.includes("hemostatica")) engTerm = "hemostat";
      else if (lowerQuery.includes("pinza") && lowerQuery.includes("garra")) engTerm = "tissue forceps";
      else if (lowerQuery.includes("pinza")) engTerm = "surgical forceps";
      else if (lowerQuery.includes("tijera") && lowerQuery.includes("metzen")) engTerm = "metzenbaum scissors";
      else if (lowerQuery.includes("tijera") && lowerQuery.includes("mayo")) engTerm = "mayo scissors";
      else if (lowerQuery.includes("tijera")) engTerm = "surgical scissors";
      else if (lowerQuery.includes("bisturi")) engTerm = "scalpel surgical";
      else if (lowerQuery.includes("separador") || lowerQuery.includes("farabeuf")) engTerm = "surgical retractor";
      else if (lowerQuery.includes("cama") && lowerQuery.includes("hospital")) engTerm = "hospital bed";
      else if (lowerQuery.includes("monitor")) engTerm = "hospital patient monitor";
      else if (lowerQuery.includes("desfibrilador")) engTerm = "defibrillator";
      try {
        const enWikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          engTerm
        )}&prop=pageimages&pithumbsize=500&format=json&origin=*`;
        const enRes = await fetch(enWikiUrl, { signal: AbortSignal.timeout(4e3) });
        if (enRes.ok) {
          const enData = await enRes.json();
          if (enData.query && enData.query.pages) {
            for (const pid of Object.keys(enData.query.pages)) {
              const p = enData.query.pages[pid];
              const thumb = p.thumbnail?.source;
              const titleNorm = cleanNorm(p.title || "");
              if (!thumb) continue;
              if (NON_MEDICAL_BLACKLIST.some((bl) => titleNorm.includes(bl))) continue;
              const isEnglishMedical = titleNorm.includes("forceps") || titleNorm.includes("clamp") || titleNorm.includes("hemostat") || titleNorm.includes("scissors") || titleNorm.includes("retractor") || titleNorm.includes("scalpel") || titleNorm.includes("needle holder") || titleNorm.includes("patient monitor") || titleNorm.includes("defibrillator") || titleNorm.includes("electrosurgery") || titleNorm.includes("surgical instrument");
              if (!isEnglishMedical) continue;
              if (queryPinzaFamily && !titleNorm.includes("forceps") && !titleNorm.includes("clamp") && !titleNorm.includes("hemostat") && !titleNorm.includes(queryPinzaFamily)) {
                continue;
              }
              if (queryTijeraFamily) {
                const normTijera = queryTijeraFamily === "metzembaum" ? "metzenbaum" : queryTijeraFamily;
                if (!titleNorm.includes(normTijera) && !titleNorm.includes("scissors")) continue;
                if (normTijera === "mayo" && titleNorm.includes("metzenbaum")) continue;
                if (normTijera === "metzenbaum" && titleNorm.includes("mayo")) continue;
              }
              if (isSeparador && !titleNorm.includes("retractor") && !titleNorm.includes("farabeuf")) {
                continue;
              }
              addResult({
                title: `${p.title} - Surgical Instrument / Medical Equipment`,
                url: thumb,
                thumbnail: thumb,
                source: "Biblioteca M\xE9dica Internacional"
              });
              if (results.length >= 14) break;
            }
          }
        }
      } catch (_enErr) {
      }
    }
    if (results.length < 6) {
      try {
        let commonsQuery = (simplifiedTerms || rawClean).replace(/\s+/g, " ");
        if (!commonsQuery.toLowerCase().includes("forceps") && !commonsQuery.toLowerCase().includes("surgical") && !commonsQuery.toLowerCase().includes("medical") && !commonsQuery.toLowerCase().includes("instrument")) {
          if (queryPinzaFamily) {
            commonsQuery = `${queryPinzaFamily} forceps`;
          } else if (queryTijeraFamily) {
            commonsQuery = `${queryTijeraFamily} scissors`;
          } else if (isSeparador) {
            commonsQuery = "Farabeuf retractor";
          } else {
            commonsQuery = `${commonsQuery} surgical instrument`;
          }
        }
        const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          commonsQuery + " filetype:bitmap"
        )}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=500&format=json&origin=*`;
        const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(5e3) });
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.query && wikiData.query.pages) {
            for (const pageId of Object.keys(wikiData.query.pages)) {
              const page = wikiData.query.pages[pageId];
              const info = page.imageinfo && page.imageinfo[0];
              const rawTitle = page.title || "";
              const titleLower = rawTitle.toLowerCase();
              if (NON_MEDICAL_BLACKLIST.some((bl) => titleLower.includes(bl))) continue;
              if (titleLower.endsWith(".pdf") || titleLower.endsWith(".djvu") || titleLower.includes("manual") || titleLower.includes("revista")) continue;
              if (queryPinzaFamily && !titleLower.includes("forceps") && !titleLower.includes("clamp") && !titleLower.includes(queryPinzaFamily)) {
                continue;
              }
              if (info && info.thumburl && info.mime && info.mime.startsWith("image/") && !info.mime.includes("tiff")) {
                addResult({
                  title: rawTitle.replace(/^File:/i, "").replace(/\.[a-zA-Z0-9]+$/, ""),
                  url: info.url || info.thumburl,
                  thumbnail: info.thumburl,
                  width: info.width,
                  height: info.height,
                  source: "Wikimedia Commons (Fotograf\xEDa M\xE9dica)"
                });
                if (results.length >= 16) break;
              }
            }
          }
        }
      } catch (wikiErr) {
        console.warn("Wikimedia image search warning:", wikiErr?.message || wikiErr);
      }
    }
    return results;
  }
  app.post("/api/products/search-images", async (req, res) => {
    try {
      const { query, equipmentName, brand, model } = req.body;
      const finalQuery = (query || [equipmentName, brand, model].filter(Boolean).join(" ")).trim();
      if (!finalQuery) {
        return res.status(400).json({ error: "Query or equipmentName is required" });
      }
      const images = await searchInternetProductImages(finalQuery);
      return res.json({ success: true, query: finalQuery, images });
    } catch (err) {
      console.error("Error in POST /api/products/search-images:", err?.message || err);
      return res.status(200).json({ success: false, images: [], error: err.message });
    }
  });
  app.get("/api/products/search-images", async (req, res) => {
    try {
      const q = (req.query.q || "").trim();
      if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
      const images = await searchInternetProductImages(q);
      return res.json({ success: true, query: q, images });
    } catch (err) {
      return res.status(200).json({ success: false, images: [], error: err.message });
    }
  });
  app.post("/api/proxy-image", async (req, res) => {
    try {
      let { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Image URL is required" });
      }
      if (url.startsWith("data:")) {
        return res.json({ success: true, dataUrl: url });
      }
      if (url.includes("wikimedia.org") && url.includes("/800px-")) {
        url = url.replace(/\/800px-/, "/500px-");
      }
      const fetchCandidate = async (target) => {
        return await fetch(target, {
          headers: {
            "User-Agent": "SydColombiaBiomedicalApp/1.0 (https://sydcolombia.com; contact@sydcolombia.com)",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          },
          signal: AbortSignal.timeout(9e3)
        });
      };
      let imgRes = null;
      try {
        imgRes = await fetchCandidate(url);
      } catch (_e) {
      }
      if ((!imgRes || !imgRes.ok) && url.includes("wikimedia.org")) {
        const alt500 = url.replace(/\/\d+px-/, "/500px-");
        if (alt500 !== url) {
          try {
            const retry500 = await fetchCandidate(alt500);
            if (retry500.ok) imgRes = retry500;
          } catch (_e) {
          }
        }
        if (!imgRes || !imgRes.ok) {
          const match = url.match(/wikimedia\.org\/wikipedia\/commons\/thumb\/([a-z0-9]+\/[a-z0-9]+\/[^/]+)/i);
          if (match && match[1]) {
            try {
              const directUrl = `https://upload.wikimedia.org/wikipedia/commons/${match[1]}`;
              const retryDirect = await fetchCandidate(directUrl);
              if (retryDirect.ok) imgRes = retryDirect;
            } catch (_e) {
            }
          }
        }
      }
      if (!imgRes || !imgRes.ok) {
        return res.status(200).json({
          success: false,
          error: `Could not fetch image: status ${imgRes ? imgRes.status : "network error"}`
        });
      }
      const rawContentType = imgRes.headers.get("content-type") || "image/jpeg";
      const contentType = rawContentType.split(";")[0].trim();
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const dataUrl = `data:${contentType};base64,${base64}`;
      return res.json({ success: true, dataUrl, contentType, size: buffer.length });
    } catch (err) {
      return res.status(200).json({ success: false, error: err?.message || "Error processing image" });
    }
  });
  app.get("/api/proxy-image", async (req, res) => {
    try {
      let targetUrl = req.query.url;
      if (!targetUrl) {
        return res.status(400).send("Target URL is required");
      }
      if (targetUrl.includes("wikimedia.org") && targetUrl.includes("/800px-")) {
        targetUrl = targetUrl.replace(/\/800px-/, "/500px-");
      }
      const imgRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "SydColombiaBiomedicalApp/1.0 (https://sydcolombia.com; contact@sydcolombia.com)",
          "Accept": "image/*,*/*"
        },
        signal: AbortSignal.timeout(1e4)
      });
      if (!imgRes.ok) {
        return res.status(imgRes.status).send("Could not fetch target image");
      }
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const arrayBuffer = await imgRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (_err) {
      return res.status(500).send("Error streaming proxied image");
    }
  });
  function getBiomedicalHeuristicDescription(trimmed) {
    const lower = trimmed.toLowerCase();
    if (lower.includes("monitor") || lower.includes("signos vitales") || lower.includes("multipar\xE1metro") || lower.includes("epm") || lower.includes("ipm") || lower.includes("beneview")) {
      return "Monitor multipar\xE1metro de alta precisi\xF3n para visualizaci\xF3n continua de signos vitales en \xE1reas hospitalarias y cuidados cr\xEDticos.";
    } else if (lower.includes("electrobisturi") || lower.includes("electrocirug") || lower.includes("bovie") || lower.includes("aaron")) {
      return "Unidad electroquir\xFArgica de alta frecuencia para corte y coagulaci\xF3n en procedimientos quir\xFArgicos especializados.";
    } else if (lower.includes("desfibrilador") || lower.includes("dea") || lower.includes("beneheart")) {
      return "Desfibrilador / monitor bif\xE1sico para reanimaci\xF3n cardiopulmonar y cardioversi\xF3n en urgencias y UCI.";
    } else if (lower.includes("electrocardiog") || lower.includes("ecg") || lower.includes("ekg") || lower.includes("beneheart r3")) {
      return "Electrocardi\xF3grafo digital de alta resoluci\xF3n para adquisici\xF3n, an\xE1lisis y registro de 12 derivaciones est\xE1ndar.";
    } else if (lower.includes("ecografo") || lower.includes("ultrasonido") || lower.includes("m6") || lower.includes("dc-40") || lower.includes("consola")) {
      return "Sistema de ultrasonido diagn\xF3stico de alto rendimiento con procesamiento avanzado de imagen y transductores multifrecuencia.";
    } else if (lower.includes("ventilador") || lower.includes("respirador") || lower.includes("sv300") || lower.includes("synovent")) {
      return "Ventilador mec\xE1nico para soporte respiratorio invasivo y no invasivo en pacientes neonatales, pedi\xE1tricos y adultos.";
    } else if (lower.includes("bomba de infusion") || lower.includes("infusion") || lower.includes("sk-600") || lower.includes("benefusion")) {
      return "Bomba de infusi\xF3n volum\xE9trica de alta precisi\xF3n con sistema de seguridad para administraci\xF3n intravenosa de fluidos y medicamentos.";
    } else if (lower.includes("laringoscopio") || lower.includes("valva") || lower.includes("fibra optica")) {
      return "Dispositivo de intubaci\xF3n endotraqueal e inspecci\xF3n de v\xEDa a\xE9rea con hojas intercambiables y tecnolog\xEDa de iluminaci\xF3n LED/fibra \xF3ptica.";
    } else if (lower.includes("tensiometro") || lower.includes("brazalete") || lower.includes("aneroide")) {
      return "Instrumento de diagn\xF3stico no invasivo para medici\xF3n precisa de la presi\xF3n arterial en pacientes pedi\xE1tricos y adultos.";
    } else if (lower.includes("fonendoscopio") || lower.includes("estetoscopio") || lower.includes("littmann")) {
      return "Instrumento ac\xFAstico m\xE9dico de alta sensibilidad para auscultaci\xF3n card\xEDaca, pulmonar y vascular en consulta cl\xEDnica.";
    } else if (lower.includes("otoscopio") || lower.includes("oftalmoscopio") || lower.includes("diagnostico")) {
      return "Equipo de diagn\xF3stico para examen e inspecci\xF3n visual de alta definici\xF3n de cavidades y estructuras anat\xF3micas.";
    } else if (lower.includes("pinza") || lower.includes("tijera") || lower.includes("instrumental") || lower.includes("portaagujas") || lower.includes("cureta")) {
      return "Instrumental quir\xFArgico de acero inoxidable de alta durabilidad para procedimientos m\xE9dicos especializados y cirug\xEDa general.";
    } else if (lower.includes("incubadora") || lower.includes("servocuna") || lower.includes("calor radiante")) {
      return "Sistema neonatal de microambiente t\xE9rmico controlado con servocontrol de temperatura y humedad para reci\xE9n nacidos cr\xEDticos.";
    } else if (lower.includes("fetal") || lower.includes("tocografo") || lower.includes("cardiotocografo")) {
      return "Monitor fetal para registro continuo de frecuencia card\xEDaca fetal y actividad uterina materna durante el embarazo y parto.";
    } else if (lower.includes("mesa") || lower.includes("camilla") || lower.includes("cama") || lower.includes("quirurgica")) {
      return "Mobiliario cl\xEDnico ergon\xF3mico con accionamiento de alta resistencia para procedimientos m\xE9dicos y confort del paciente.";
    } else if (lower.includes("lampara") || lower.includes("cialitica")) {
      return "L\xE1mpara de examinaci\xF3n / quir\xFArgica de tecnolog\xEDa LED con campo de iluminaci\xF3n homog\xE9neo y control de intensidad.";
    } else if (lower.includes("autoclave") || lower.includes("esterilizador")) {
      return "Equipo de esterilizaci\xF3n por vapor de agua con ciclos programados para instrumental m\xE9dico y quir\xFArgico.";
    } else if (lower.includes("aspirador") || lower.includes("succion")) {
      return "Unidad de aspiraci\xF3n quir\xFArgica continua de alto vac\xEDo y caudal para recolecci\xF3n de fluidos cl\xEDnicos.";
    }
    return "";
  }
  app.post("/api/gemini/equipment-description", async (req, res) => {
    try {
      const { equipmentName, brand, model } = req.body;
      if (!equipmentName || typeof equipmentName !== "string" || equipmentName.trim().length < 3) {
        return res.json({ found: false, description: "" });
      }
      const trimmed = equipmentName.trim();
      const isRepeatedOrJunk = /^([a-zA-Z])\1{2,}$/i.test(trimmed) || /^(asdf|jaja|test|prueba|1234|qwerty)/i.test(trimmed);
      if (isRepeatedOrJunk) {
        return res.json({ found: false, description: "" });
      }
      const ai = getGeminiClient();
      if (!ai) {
        const fallbackDesc2 = getBiomedicalHeuristicDescription(trimmed);
        if (fallbackDesc2) {
          return res.json({ found: true, description: fallbackDesc2 });
        }
        return res.json({ found: false, description: "" });
      }
      const prompt = `Eres un Ingeniero Biom\xE9dico y especialista en cat\xE1logo de dispositivos m\xE9dicos para SYD Colombia.
Analiza la siguiente informaci\xF3n ingresada:
- Nombre: "${trimmed}"
- Marca: "${brand || ""}"
- Modelo: "${model || ""}"

Instrucciones:
1. Eval\xFAa si el texto corresponde a un equipo m\xE9dico, dispositivo cl\xEDnico, instrumental o tecnolog\xEDa hospitalaria REAL (por ejemplo: monitores de signos vitales, electrocardi\xF3grafos, electrobistur\xEDs, desfibriladores, ec\xF3grafos, ventiladores mec\xE1nicos, bombas de infusi\xF3n, l\xE1mparas cial\xEDticas, mesas quir\xFArgicas, etc.).
2. Si ES un equipo m\xE9dico reconocible:
   - "found": true
   - "description": Redacta una descripci\xF3n comercial y t\xE9cnica breve, profesional y precisa (1 o m\xE1ximo 2 oraciones, no m\xE1s de 170 caracteres), destacando su aplicaci\xF3n cl\xEDnica principal y tecnolog\xEDa destacada.
3. Si NO es un equipo m\xE9dico, o si el texto es texto de prueba, letras al azar (ej: "ajjaja", "sadsdasad", "zzz"), o no existe certeza cl\xEDnica de qu\xE9 es:
   - "found": false
   - "description": "" (cadena totalmente vac\xEDa).

Devuelve EXCLUSIVAMENTE un objeto JSON v\xE1lido:
{
  "found": true,
  "description": "Monitor multipar\xE1metro de alta precisi\xF3n para visualizaci\xF3n continua de signos vitales en \xE1reas de hospitalizaci\xF3n y cuidados cr\xEDticos."
}`;
      let responseText = "{}";
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn("Gemini description capacity fallback triggered:", geminiError?.message || geminiError);
        const fallbackDesc2 = getBiomedicalHeuristicDescription(trimmed);
        if (fallbackDesc2) {
          return res.json({ found: true, description: fallbackDesc2 });
        }
        return res.json({ found: false, description: "" });
      }
      try {
        const parsedData = JSON.parse(responseText);
        const hasValidDesc = Boolean(parsedData.found && parsedData.description && parsedData.description.trim() !== "");
        if (hasValidDesc) {
          return res.json({
            found: true,
            description: parsedData.description.trim()
          });
        }
      } catch (parseErr) {
        console.warn("Error parsing Gemini description response:", parseErr);
      }
      const fallbackDesc = getBiomedicalHeuristicDescription(trimmed);
      if (fallbackDesc) {
        return res.json({ found: true, description: fallbackDesc });
      }
      return res.json({ found: false, description: "" });
    } catch (err) {
      console.warn("Error handling equipment description request:", err?.message || err);
      const fallbackDesc = getBiomedicalHeuristicDescription(req.body?.equipmentName || "");
      if (fallbackDesc) {
        return res.json({ found: true, description: fallbackDesc });
      }
      return res.json({ found: false, description: "" });
    }
  });
  app.post("/api/gemini/extract-contract-from-image", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ error: "imageBase64 is required" });
      }
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: "Gemini AI no est\xE1 configurado en el servidor"
        });
      }
      let cleanBase64 = imageBase64.trim();
      let detectedMime = mimeType || "image/jpeg";
      if (cleanBase64.includes(";base64,")) {
        const parts = cleanBase64.split(";base64,");
        const mimeMatch = parts[0].match(/data:(.*?);/);
        if (mimeMatch) {
          detectedMime = mimeMatch[1].trim();
        }
        cleanBase64 = parts[1].trim();
      }
      cleanBase64 = cleanBase64.replace(/\s+/g, "");
      const prompt = `Eres un Asistente Experto en Contrataci\xF3n P\xFAblica en Colombia (SECOP I, SECOP II, pliegos de condiciones, contratos hospitalarios, resoluciones, \xF3rdenes de compra y licitaciones m\xE9dicas) para SYD Colombia.
Analiza con m\xE1xima precisi\xF3n la imagen, fotograf\xEDa, escaneo o captura de pantalla del documento adjunto (pliego de condiciones, resumen de licitaci\xF3n, acta de inicio, car\xE1tula contractual, extracto de SECOP II, invitaci\xF3n o carta de solicitud).

Tu tarea es leer y extraer con m\xE1xima precisi\xF3n todos los datos que correspondan al contrato o licitaci\xF3n:

Campos a extraer:
1. clientName: Nombre oficial y completo de la Entidad contratante / Hospital / IPS / Cl\xEDnica / E.S.E. / Secretar\xEDa de Salud / Alcald\xEDa / Gobernaci\xF3n (ej: "Hospital Universitario San Ignacio", "Subred Integrada de Servicios de Salud Centro Oriente E.S.E.", "Hospital Departamental de Nari\xF1o", etc.).
2. nit: NIT de la entidad con o sin d\xEDgito de verificaci\xF3n (ej: "860.012.345-1"). Si no es legible o no aparece, deja "".
3. processNumber: N\xFAmero de proceso, radicado de convocatoria, n\xFAmero de contrato o c\xF3digo del pliego (ej: "LP-2026-045", "SAM-012-2026", "CD-089-2025", "CO-1234").
4. budgetCOP: Valor total del contrato, cuant\xEDa o presupuesto oficial expresado \xDANICAMENTE como n\xFAmero entero en pesos colombianos (COP). Por ejemplo, si en el documento dice "$ 280.000.000 COP", "$280.000.000,00", o "DOSCIENTOS OCHENTA MILLONES DE PESOS", devuelve 280000000. Si no aparece o no se especifica, devuelve 0.
5. city: Ciudad o municipio donde se ejecuta el contrato o sede de la entidad (ej: "Bogot\xE1 D.C.", "Medell\xEDn", "Cali", "Barranquilla", "Pasto", etc.). Si no aparece, usa "Bogot\xE1 D.C.".
6. processType: Modalidad de contrataci\xF3n exacta o deducida. Debe ser EXACTAMENTE uno de los siguientes valores:
   - "Licitaci\xF3n P\xFAblica"
   - "Selecci\xF3n Abreviada"
   - "Convocatoria Privada"
   - "Contrataci\xF3n Directa"
   - "Subasta Inversa Electr\xF3nica"
   (Si no est\xE1 expl\xEDcito, usa "Licitaci\xF3n P\xFAblica").
7. contractObject: Objeto del contrato o descripci\xF3n detallada de lo que se va a contratar o suministrar (ej: "Adquisici\xF3n, instalaci\xF3n, pruebas y puesta en funcionamiento de equipos biom\xE9dicos hospitalarios...").
8. executionTerm: Tiempo o plazo de ejecuci\xF3n contractual (ej: "30 d\xEDas calendario", "60 d\xEDas h\xE1biles", "6 meses", "Hasta el 31 de diciembre de 2026", etc.). Si no aparece, deja "".
9. contactPerson: Nombre de la persona de contacto, ordenador del gasto, interventor o funcionario responsable si aparece (ej: "Dr. Roberto M\xE9ndez"). Si no aparece, deja "".
10. openingDate: Fecha de apertura o publicaci\xF3n si aparece (en formato YYYY-MM-DD). Si no aparece, deja "".
11. closingDate: Fecha de cierre, presentaci\xF3n de ofertas o entrega si aparece (en formato YYYY-MM-DD). Si no aparece, deja "".
12. status: Estado del proyecto ("En Preparaci\xF3n", "Presentada", "Adjudicada"). Si el documento indica que el contrato fue adjudicado, firmado, es un acta de adjudicaci\xF3n o contrato perfeccionado, usa "Adjudicada". Si es un borrador o aviso de convocatoria, usa "En Preparaci\xF3n".

Devuelve EXCLUSIVAMENTE un objeto JSON v\xE1lido con esta estructura:
{
  "clientName": "Nombre de la Entidad",
  "nit": "860.000.000-1",
  "processNumber": "LP-2026-001",
  "budgetCOP": 280000000,
  "city": "Bogot\xE1 D.C.",
  "processType": "Licitaci\xF3n P\xFAblica",
  "contractObject": "Objeto del contrato...",
  "executionTerm": "60 d\xEDas calendario",
  "contactPerson": "Dr. Nombre Apellido",
  "openingDate": "",
  "closingDate": "",
  "status": "En Preparaci\xF3n"
}`;
      const modelsToTry = ["gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let lastError = null;
      let responseText = "";
      for (const modelName of modelsToTry) {
        try {
          const config = {
            responseMimeType: "application/json",
            temperature: 0.1
          };
          if (modelName === "gemini-3.7-flash" || modelName.includes("3.7")) {
            config.thinkingConfig = { thinkingBudget: 0 };
          }
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: detectedMime
                }
              },
              {
                text: prompt
              }
            ],
            config
          });
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (err) {
          lastError = err;
          console.warn(`Model ${modelName} error on OCR contract image:`, err?.status || err?.message);
        }
      }
      if (!responseText) {
        throw lastError || new Error("No se pudo extraer texto de la imagen");
      }
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      const firstBrace = cleanJson.indexOf("{");
      const lastBrace = cleanJson.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }
      const parsedData = JSON.parse(cleanJson);
      if (parsedData.budgetCOP !== void 0) {
        parsedData.budgetCOP = Number(parsedData.budgetCOP) || 0;
      }
      return res.json({
        success: true,
        data: parsedData
      });
    } catch (err) {
      console.error("Error extracting contract from image:", err);
      return res.status(500).json({
        error: err.message || "Error al procesar la imagen del contrato"
      });
    }
  });
  app.post("/api/gemini/chat-assistant", async (req, res) => {
    try {
      const { message, history, context } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" });
      }
      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          reply: "\xA1Hola! Soy **Mara**, tu Asistente Biom\xE9dica y Copiloto de Inteligencia Artificial en SYD Colombia. Puedo aconsejarte y guiarte paso a paso sobre c\xF3mo cotizar, calcular costos y m\xE1rgenes (L1 a L8), hacer seguimiento a \xD3rdenes de Compra (OC), gestionar proveedores o estructurar pliegos para SECOP II.",
          actions: [
            { label: "Ir al Cotizador", type: "navigate", tab: "ventas", primary: true },
            { label: "Seguimiento de OC", type: "navigate", tab: "seguimiento_oc" },
            { label: "Directorio de Proveedores", type: "modal", modalAction: "manage_suppliers" },
            { label: "Gestor de Costos & TRM", type: "navigate", tab: "costos" },
            { label: "Licitaciones SECOP II", type: "navigate", tab: "licitaciones" }
          ]
        });
      }
      let historyText = "";
      if (Array.isArray(history) && history.length > 0) {
        historyText = history.slice(-6).map((h) => `${h.sender === "user" ? "Usuario" : "Mara"}: ${h.text}`).join("\n");
      }
      const prompt = `Eres "Mara", la Asistente Inteligente de Inteligencia Artificial oficial de SYD Colombia (empresa l\xEDder en comercializaci\xF3n, importaci\xF3n e ingenier\xEDa biom\xE9dica de tecnolog\xEDa hospitalaria en Colombia).

TU PERSONALIDAD Y FORMA DE RESPONDER:
- Eres sumamente inteligente, clara, amable, estructurada, ejecutiva y especialista en ingenier\xEDa biom\xE9dica y compras hospitalarias.
- Cuando el usuario te pregunte c\xF3mo hacer algo en la plataforma, sobre un equipo, sobre proveedores, c\xE1lculos o temas biom\xE9dicos:
  1. Acons\xE9jale qu\xE9 es lo m\xE1s conveniente y seguro seg\xFAn la normatividad colombiana (INVIMA, TRM, cobertura de margen, pliegos SECOP II, log\xEDstica de importaci\xF3n).
  2. Dale las opciones y los pasos claros y f\xE1ciles de seguir (ej: "Paso 1: ..., Paso 2: ...").
  3. Provee SIEMPRE botones de acci\xF3n ('actions') pertinentes para que el usuario pueda hacer clic y abrir la ventana o el modal exacto sin tener que buscarlo manualmente.
  4. Utiliza los datos del contexto din\xE1mico en tiempo real para dar cifras exactas cuando corresponda (ej: cu\xE1ntos equipos hay registrados, TRM actual, cotizaciones u OCs activas).

ARQUITECTURA COMPLETA DE M\xD3DULOS Y CAPACIDADES EN LA APP SYD COLOMBIA:
1. M\xF3dulo 'inicio' (Dashboard General & TRM):
   - Visi\xF3n global de m\xE9tricas del negocio, cotizaciones del mes, OCs en tr\xE1nsito, TRM en tiempo real y TRM recomendada (+5%).
   - Bot\xF3n acci\xF3n: { "label": "Ir a Inicio", "type": "navigate", "tab": "inicio" }

2. M\xF3dulo 'ventas' (Cotizador Comercial Oficial):
   - Selecci\xF3n de equipos m\xE9dicos del cat\xE1logo, accesorios base incluidos y accesorios opcionales.
   - Manejo de IVA (19% o 0% exento para dispositivos m\xE9dicos espec\xEDficos seg\xFAn estatuto tributario).
   - M\xE1rgenes de ganancia (L1: 15% hasta L8: 80% o factor libre) con c\xE1lculo de venta: Precio = Costo / (1 - %Margen).
   - Generaci\xF3n, previsualizaci\xF3n e impresi\xF3n de PDF formal con membrete corporativo, logos y firma.
   - Botones acci\xF3n:
     * { "label": "Abrir Cotizador", "type": "navigate", "tab": "ventas", "primary": true }
     * { "label": "Nueva Cotizaci\xF3n", "type": "modal", "modalAction": "new_quote" }
     * { "label": "Vista Previa / Imprimir PDF", "type": "modal", "modalAction": "print_preview" }

3. M\xF3dulo 'historial' (Historial de Cotizaciones):
   - Control de propuestas guardadas, estados (Borrador, Enviada, Aprobada, Rechazada, Facturada).
   - Carga de cotizaciones pasadas al cotizador o duplicaci\xF3n r\xE1pida para nuevos clientes.
   - Bot\xF3n acci\xF3n: { "label": "Ver Historial de Cotizaciones", "type": "navigate", "tab": "historial" }

4. M\xF3dulo 'costos' (Gestor de Costos & TRM Automatizada):
   - TRM Oficial del Banco de la Rep\xFAblica / Superfinanciera que se actualiza AUTOM\xC1TICAMENTE en segundo plano cada 2 horas.
   - TRM Recomendada (+5% de margen de seguridad para amortiguar la volatilidad cambiaria del d\xF3lar).
   - Matriz de costos de equipos y accesorios en COP y USD, m\xE1rgenes L1 (15%), L2 (20%), L2.5 (25%), L3 (30%), L3.5 (35%), L4 (40%), L5 (50%), L6 (60%), L7 (70%), L8 (80%), techo de precios hospitalarios, personalizador de columnas visibles y exportaci\xF3n a Excel.
   - Bot\xF3n acci\xF3n: { "label": "Abrir Gestor de Costos & TRM", "type": "navigate", "tab": "costos" }

5. M\xF3dulo 'catalogo' (Cat\xE1logo de Equipos M\xE9dicos):
   - Base multimarca de dispositivos biom\xE9dicos (Mindray, Edan, Bovie, Philips, Zoll, GE, etc.).
   - Generaci\xF3n asistida por IA de descripciones t\xE9cnicas, registros INVIMA con sem\xE1foro de vigencia y accesorios.
   - Botones acci\xF3n:
     * { "label": "Ver Cat\xE1logo de Equipos", "type": "navigate", "tab": "catalogo" }
     * { "label": "Registrar Nuevo Equipo", "type": "modal", "modalAction": "new_equipment", "primary": true }

6. M\xF3dulo 'licitaciones' (Licitaciones & SECOP II):
   - Estructuraci\xF3n de proyectos por hospital/cliente, matriz de cumplimiento t\xE9cnico ("Cumple / No Cumple / Folio").
   - Optimizador Biom\xE9dico de Especificaciones T\xE9cnicas con IA: Detecta par\xE1metros medibles y genera RANGOS AMPLIOS y holgados (ej: "entre 10 a 12.1 pulgadas", "15 a 300 lpm", "10 a 270 mmHg", "2 a 5 horas", 4 variantes: between/min/max/fixed, blindajes isUnique).
   - Importador masivo de pliegos desde Excel (modo anexar o reemplazar) y exportaci\xF3n a Excel.
   - Bot\xF3n acci\xF3n: { "label": "Ir a Licitaciones SECOP II", "type": "navigate", "tab": "licitaciones" }

7. M\xF3dulo 'seguimiento_oc' (Seguimiento de \xD3rdenes de Compra & Log\xEDstica Internacional):
   - Trazabilidad integral de compras vinculadas a licitaciones adjudicadas o cotizaciones aprobadas.
   - 11 Estados log\xEDsticos: Borrador -> Emitida -> Confirmada por Proveedor -> En Fabricaci\xF3n -> En Tr\xE1nsito -> En Aduana / Nacionalizaci\xF3n -> Equipos en Bodega SYD -> En Ingreso T\xE9cnico -> Listo para Despacho -> Despachado al Cliente -> Entregado e Instalado -> Cerrado.
   - Alertas autom\xE1ticas de 48 horas cuando un equipo lleva m\xE1s de 48h en un estado cr\xEDtico (como aduana o listo en f\xE1brica).
   - Seriales f\xEDsicos de dispositivos, n\xFAmeros de lote y declaraciones/manifiestos de importaci\xF3n aduanera DIAN.
   - Estados de pago: Anticipo 50%, Contado 100%, Cr\xE9dito 30/60/90 d\xEDas (Vigente / Pagado).
   - Bot\xF3n acci\xF3n: { "label": "Ir a Seguimiento de OC", "type": "navigate", "tab": "seguimiento_oc" }

8. M\xF3dulo 'sales_orders' (\xD3rdenes de Venta & Facturaci\xF3n):
   - Generaci\xF3n de \xD3rdenes de Venta (OV) comerciales a partir de cotizaciones ganadas o contratos adjudicados.
   - Remisiones de entrega formal con transportadora, n\xFAmero de gu\xEDa, fecha y firmas digitales de recibido hospitalario.
   - Radicaci\xF3n de Facturas Electr\xF3nicas DIAN, fecha de expedici\xF3n, fecha de radicaci\xF3n y control de cartera de cobranza (Pendiente, Parcial, Pagada).
   - Generaci\xF3n de Actas de Recibido a Satisfacci\xF3n para soporte de cobro a IPS y EPS.
   - Bot\xF3n acci\xF3n: { "label": "Ir a \xD3rdenes de Venta (OV)", "type": "navigate", "tab": "sales_orders" }

9. Directorio de Proveedores y Fabricantes (dentro de Seguimiento de OC):
   - Gesti\xF3n de proveedores aliados, marcas autorizadas, contactos, correos y condiciones de pago.
   - Al abrir, muestra la lista de proveedores a la izquierda sin tapar la vista.
   - El bot\xF3n superior "Nuevo Proveedor" despliega el formulario al lado derecho en paralelo.
   - Al seleccionar un proveedor se muestra su ficha, la cual se puede quitar en cualquier momento pulsando "Quitar Ficha" o haciendo clic de nuevo sobre \xE9l.
   - Bot\xF3n acci\xF3n: { "label": "Abrir Directorio de Proveedores", "type": "modal", "modalAction": "manage_suppliers" }

10. M\xF3dulo 'documentacion' (Repositorio T\xE9cnico & INVIMA):
    - Fichas t\xE9cnicas, registros sanitarios INVIMA, manuales de usuario/servicio y certificados de calidad con control de vencimiento.
    - Botones acci\xF3n:
      * { "label": "Abrir Repositorio de Documentos", "type": "navigate", "tab": "documentacion" }
      * { "label": "Subir Ficha / Registro INVIMA", "type": "modal", "modalAction": "new_document", "primary": true }

11. Base de Datos, Excel (.xlsx) & Consola Relacional SQL:
    - Descarga e importaci\xF3n en formato Excel Multi-Hoja (.xlsx) para respaldo y migraci\xF3n de datos.
    - Consola SQL Relacional interactiva con autenticaci\xF3n protegida para administradores.
    - Bot\xF3n acci\xF3n: { "label": "Abrir Base de Datos & Excel", "type": "modal", "modalAction": "backup_management" }

12. Herramientas Globales & Atajos:
    - Cierre universal con tecla Escape (ESC): Cierra al instante cualquier modal, drawer o panel flotante.
    - Widget Flotante de Alertas: Alerta sobre cotizaciones por vencer, retrasos en OCs, pagos y registros INVIMA.
    - Chat Dual: Mara IA + Chat de Equipo interno en tiempo real (General y directos).
    - Administraci\xF3n de Usuarios & Roles RBAC: Matriz de 14 permisos granulares editables de seguido sin reinicios a admin. { "label": "Administrar Usuarios", "type": "modal", "modalAction": "user_management" }
    - Centro de Actualizaciones: Notificaciones autom\xE1ticas de nuevas versiones del sistema (Versi\xF3n actual: v2.7.0). { "label": "Centro de Actualizaciones", "type": "modal", "modalAction": "app_updates" }
    - Personalizaci\xF3n Visual: { "label": "Personalizar Logo & Colores", "type": "modal", "modalAction": "customization" }

13. Integraci\xF3n Google Workspace & Formato N-FCO-03:
    - Importaci\xF3n de partes y equipos m\xE9dicos desde hojas oficiales Google Sheets.
    - Validaci\xF3n estricta: Detecci\xF3n de solicitudes de INACTIVACI\xD3N bloqueando la creaci\xF3n de partes descontinuadas y marc\xE1ndolas como inactivas. Modificaciones y creaciones limpias desde el c\xF3digo de parte.
    - Bot\xF3n acci\xF3n: { "label": "Abrir Google Workspace", "type": "modal", "modalAction": "google_workspace" }

14. Gmail Compras & Cach\xE9 Local de Cuota:
    - Monitoreo de correos de compras y confirmaciones de pedidos de proveedores con protecci\xF3n de cuota local.
    - Bot\xF3n acci\xF3n: { "label": "Abrir Gmail Compras", "type": "modal", "modalAction": "gmail_compras" }

15. Unificaci\xF3n Maestra de Proveedores & Directorio de Clientes:
    - Fusi\xF3n autom\xE1tica de proveedores duplicados (como T\xE9cnica Electrom\xE9dica y T\xE9cnica) unificando marcas (Welch Allyn, Seca, Ca-Mi, Comen, Mindray) y todos sus equipos vinculados.
    - Directorio de clientes con eliminaci\xF3n interactiva segura y persistente en la nube.
    - Bot\xF3n acci\xF3n: { "label": "Abrir Directorio de Clientes", "type": "modal", "modalAction": "client_directory" }
CONTEXTO DIN\xC1MICO EN TIEMPO REAL DEL SISTEMA:
- Pesta\xF1a activa actual: ${context?.activeTab || "inicio"}
- Usuario: ${context?.userName || "Usuario"} (${context?.userRole || "Miembro SYD"})
- Equipos en cat\xE1logo: ${context?.totalEquipments ?? "Varios"}
- Cotizaciones guardadas: ${context?.totalQuotes ?? "Varias"}
- Proyectos licitatorios: ${context?.totalTenderClients ?? "Varios"}
- \xD3rdenes de Compra (OC): ${context?.totalOCContracts ?? "Varias"}
- Proveedores registrados: ${context?.totalSuppliers ?? 16}
- Documentos t\xE9cnicos: ${context?.totalDocuments ?? "Varios"}
- Alertas activas: ${context?.totalAlerts ?? 0}
- TRM Spot en vivo: $${context?.liveTRM ? Number(context.liveTRM).toLocaleString("es-CO") : "4.185"} COP
- TRM Recomendada (+5%): $${context?.recommendedTRM ? Number(context.recommendedTRM).toLocaleString("es-CO") : "4.400"} COP
- M\xF3dulos instalados: ${context?.installedModules ? JSON.stringify(context.installedModules) : "Todos los m\xF3dulos SYD"}

Historial reciente de la conversaci\xF3n:
${historyText || "(Inicio de conversaci\xF3n)"}

Mensaje del Usuario:
"${message}"

INSTRUCCIONES DE RESPUESTA:
- Pres\xE9ntate o responde como "Mara".
- Responde de forma muy clara, agradable, profesional y ejecutiva.
- Explica los pasos de forma estructurada (Paso 1, Paso 2, etc.) y brinda siempre consejos biom\xE9dicos y comerciales acordes a la normativa colombiana.
- Proporciona entre 1 y 4 botones de acci\xF3n ('actions') para que el usuario pueda ejecutarlas de inmediato.

Devuelve EXCLUSIVAMENTE un objeto JSON v\xE1lido con la siguiente estructura:
{
  "reply": "Hola, soy Mara. Para hacer esto te recomiendo lo siguiente:\\n\\n1. **Paso 1**: ...\\n2. **Paso 2**: ...\\n\\nPuedes pulsar los botones directos aqu\xED abajo para comenzar.",
  "actions": [
    {
      "label": "Texto visible en el bot\xF3n",
      "type": "navigate" | "modal" | "query",
      "tab": "ventas" | "costos" | "catalogo" | "licitaciones" | "seguimiento_oc" | "documentacion" | "historial" | "inicio",
      "modalAction": "new_equipment" | "new_document" | "new_quote" | "manage_suppliers" | "new_oc" | "alerts_widget" | "user_management" | "customization" | "print_preview",
      "queryPrompt": "\xBFC\xF3mo calcular margen?",
      "primary": true
    }
  ]
}`;
      let responseText = "{}";
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn("Gemini error for chat assistant:", geminiError);
        return res.json({
          reply: "Hola, soy Mara. Para gestionar tus procesos comerciales, compras y t\xE9cnicos en SYD Colombia, tienes a tu disposici\xF3n las siguientes opciones r\xE1pidas:",
          actions: [
            { label: "Ir al Cotizador", type: "navigate", tab: "ventas", primary: true },
            { label: "Seguimiento de OC", type: "navigate", tab: "seguimiento_oc" },
            { label: "Directorio de Proveedores", type: "modal", modalAction: "manage_suppliers" },
            { label: "Gestor de Costos & TRM", type: "navigate", tab: "costos" },
            { label: "Registrar Equipo", type: "modal", modalAction: "new_equipment" }
          ]
        });
      }
      const parsedData = JSON.parse(responseText);
      const actionsList = Array.isArray(parsedData.actions) ? parsedData.actions : parsedData.suggestedTab ? [{ label: parsedData.suggestedTabLabel || "Ir a Ventana", type: "navigate", tab: parsedData.suggestedTab, primary: true }] : [];
      return res.json({
        reply: parsedData.reply || "\xBFEn qu\xE9 m\xE1s te puedo asesorar el d\xEDa de hoy?",
        actions: actionsList
      });
    } catch (err) {
      console.warn("Error in chat assistant:", err?.message || err);
      return res.json({
        reply: "Hola, soy Mara. Estoy aqu\xED para aconsejarte y ayudarte a realizar cualquier acci\xF3n en la plataforma SYD Colombia. \xBFQu\xE9 deseas hacer a continuaci\xF3n?",
        actions: [
          { label: "Crear Cotizaci\xF3n", type: "navigate", tab: "ventas", primary: true },
          { label: "Seguimiento de OC", type: "navigate", tab: "seguimiento_oc" },
          { label: "Directorio de Proveedores", type: "modal", modalAction: "manage_suppliers" },
          { label: "Registrar Equipo", type: "modal", modalAction: "new_equipment" },
          { label: "Gestor de Costos", type: "navigate", tab: "costos" }
        ]
      });
    }
  });
  let cachedTrmPayload = null;
  let cachedTrmExpiresAt = 0;
  app.get("/api/trm", async (req, res) => {
    try {
      const now = Date.now();
      if (cachedTrmPayload && now < cachedTrmExpiresAt) {
        return res.json(cachedTrmPayload);
      }
      try {
        const socrataRes = await fetch("https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC", {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(4500)
        });
        if (socrataRes.ok) {
          const socrataData = await socrataRes.json();
          if (Array.isArray(socrataData) && socrataData.length > 0 && socrataData[0]?.valor) {
            const rawVal = parseFloat(socrataData[0].valor);
            if (!isNaN(rawVal) && rawVal > 1e3 && rawVal < 1e4) {
              const vigenciaDesde = socrataData[0].vigenciadesde;
              const vigenciaHasta = socrataData[0].vigenciahasta;
              const dateFormatted = vigenciaHasta ? new Date(vigenciaHasta).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }) : (/* @__PURE__ */ new Date()).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
              cachedTrmPayload = {
                rate: Math.round(rawVal * 100) / 100,
                date: dateFormatted,
                vigenciaDesde,
                vigenciaHasta,
                source: "Superintendencia Financiera de Colombia (Oficial)",
                isLive: true,
                lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
              };
              cachedTrmExpiresAt = now + 30 * 60 * 1e3;
              return res.json(cachedTrmPayload);
            }
          }
        }
      } catch (err) {
      }
      try {
        const erRes = await fetch("https://open.er-api.com/v6/latest/USD", {
          signal: AbortSignal.timeout(4500)
        });
        if (erRes.ok) {
          const erData = await erRes.json();
          const rate = erData?.rates?.COP;
          if (typeof rate === "number" && rate > 1e3 && rate < 1e4) {
            cachedTrmPayload = {
              rate: Math.round(rate * 100) / 100,
              date: (/* @__PURE__ */ new Date()).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }),
              source: "ExchangeRate Global en Vivo",
              isLive: true,
              lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
            };
            cachedTrmExpiresAt = now + 15 * 60 * 1e3;
            return res.json(cachedTrmPayload);
          }
        }
      } catch (err) {
      }
      return res.json({
        rate: cachedTrmPayload?.rate || 3126.08,
        date: (/* @__PURE__ */ new Date()).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }),
        source: "TRM Referencial Colombia",
        isLive: false,
        lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
      });
    } catch (error) {
      console.error("TRM general error:", error);
      res.status(500).json({ error: "Failed to fetch TRM" });
    }
  });
  app.get(["/healthz", "/health", "/api/health"], (req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/version", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.json({
      bootTime: SERVER_BOOT_TIME,
      version: APP_VERSION,
      timestamp: Date.now(),
      status: "ok"
    });
  });
  const BACKUP_CACHE_FILE = path.join(process.cwd(), "data_backup_snapshot.json");
  let inMemoryLatestState = null;
  let lastHourlyBackupTime = null;
  let lastHourlyBackupSuccess = false;
  let nextScheduledRunTime = Date.now() + 60 * 60 * 1e3;
  let currentServerStateVersion = Date.now();
  const broadcastRealtimeStateUpdate = (_senderClientId) => {
    currentServerStateVersion = Date.now();
  };
  const readCachedStateSafely = () => {
    try {
      if (fs.existsSync(BACKUP_CACHE_FILE)) {
        const raw = fs.readFileSync(BACKUP_CACHE_FILE, "utf-8").trim();
        if (raw.length > 0 && (raw.startsWith("{") || raw.startsWith("["))) {
          return JSON.parse(raw);
        }
      }
    } catch (err) {
    }
    return null;
  };
  inMemoryLatestState = readCachedStateSafely();
  app.get("/api/realtime/events", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache");
    res.json({
      status: "ok",
      version: currentServerStateVersion,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/realtime/version", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.json({
      version: currentServerStateVersion,
      timestamp: inMemoryLatestState?.timestamp || null,
      clientsConnected: 1
    });
  });
  app.get("/api/backup/latest-state", (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      if (!inMemoryLatestState) {
        inMemoryLatestState = readCachedStateSafely();
      }
      if (inMemoryLatestState) {
        return res.json({
          success: true,
          exists: true,
          version: currentServerStateVersion,
          timestamp: inMemoryLatestState.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
          data: inMemoryLatestState.data || inMemoryLatestState,
          counts: {
            equipments: inMemoryLatestState.data?.equipments?.length || inMemoryLatestState.equipmentsCount || 0,
            quotes: inMemoryLatestState.data?.quotes?.length || inMemoryLatestState.quotesCount || 0,
            tenders: inMemoryLatestState.data?.tenderProjects?.length || inMemoryLatestState.tendersCount || 0,
            contracts: inMemoryLatestState.data?.ocContracts?.length || inMemoryLatestState.contractsCount || 0,
            salesOrders: inMemoryLatestState.data?.salesOrders?.length || inMemoryLatestState.salesOrdersCount || 0,
            salesInvoices: inMemoryLatestState.data?.salesInvoices?.length || inMemoryLatestState.salesInvoicesCount || 0,
            documents: inMemoryLatestState.data?.technicalDocuments?.length || inMemoryLatestState.documentsCount || 0
          }
        });
      }
      return res.json({
        success: true,
        exists: false,
        version: currentServerStateVersion,
        data: null
      });
    } catch (err) {
      console.warn("Error reading latest backup state:", err);
      res.status(500).json({ success: false, error: err?.message || "Error loading latest state" });
    }
  });
  app.post("/api/backup/sync-state", (req, res) => {
    try {
      const payload = req.body;
      if (payload && typeof payload === "object") {
        inMemoryLatestState = payload;
        try {
          fs.writeFileSync(BACKUP_CACHE_FILE, JSON.stringify(payload, null, 2), "utf-8");
          const backupRedundantFile = path.join(process.cwd(), "data_backup_snapshot.backup.json");
          fs.writeFileSync(backupRedundantFile, JSON.stringify(payload, null, 2), "utf-8");
        } catch (fsErr) {
          console.warn("Failed to write backup snapshot to disk:", fsErr);
        }
        broadcastRealtimeStateUpdate(payload.clientId);
      }
      res.json({ success: true, version: currentServerStateVersion, cachedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (err) {
      res.status(500).json({ success: false, error: err?.message || "Error caching state" });
    }
  });
  app.post("/api/backup/delete-entity", (req, res) => {
    try {
      const { type, id, code, quoteNumber } = req.body || {};
      if (!type || !id && !code && !quoteNumber) {
        return res.status(400).json({ success: false, error: "Missing type or id" });
      }
      if (!inMemoryLatestState) {
        inMemoryLatestState = readCachedStateSafely();
      }
      if (inMemoryLatestState) {
        const root = inMemoryLatestState;
        const d = inMemoryLatestState.data || root;
        if (type === "quote") {
          if (Array.isArray(d.quotes)) d.quotes = d.quotes.filter((q) => q.id !== id && (!quoteNumber || q.quoteNumber !== quoteNumber));
          if (Array.isArray(root.quotes)) root.quotes = root.quotes.filter((q) => q.id !== id && (!quoteNumber || q.quoteNumber !== quoteNumber));
        } else if (type === "equipment") {
          if (Array.isArray(d.equipments)) d.equipments = d.equipments.filter((e) => e.id !== id && (!code || (e.code || "").trim().toUpperCase() !== String(code).trim().toUpperCase()));
          if (Array.isArray(root.equipments)) root.equipments = root.equipments.filter((e) => e.id !== id && (!code || (e.code || "").trim().toUpperCase() !== String(code).trim().toUpperCase()));
        } else if (type === "tender") {
          if (Array.isArray(d.tenderProjects)) d.tenderProjects = d.tenderProjects.filter((t) => t.id !== id);
          if (Array.isArray(root.tenderProjects)) root.tenderProjects = root.tenderProjects.filter((t) => t.id !== id);
        } else if (type === "contract") {
          if (Array.isArray(d.ocContracts)) d.ocContracts = d.ocContracts.filter((c) => c.id !== id);
          if (Array.isArray(root.ocContracts)) root.ocContracts = root.ocContracts.filter((c) => c.id !== id);
        } else if (type === "salesOrder") {
          const { salesOrderNumber, tenderClientId, contractId } = req.body || {};
          const isTargetOrder = (o) => id && o.id === id || salesOrderNumber && (o.salesOrderNumber || "").trim().toLowerCase() === String(salesOrderNumber).trim().toLowerCase() || tenderClientId && (o.tenderClientId === tenderClientId || o.contractId === tenderClientId) || contractId && (o.contractId === contractId || o.tenderClientId === contractId);
          if (Array.isArray(d.salesOrders)) d.salesOrders = d.salesOrders.filter((o) => !isTargetOrder(o));
          if (Array.isArray(root.salesOrders)) root.salesOrders = root.salesOrders.filter((o) => !isTargetOrder(o));
        } else if (type === "salesInvoice") {
          if (Array.isArray(d.salesInvoices)) d.salesInvoices = d.salesInvoices.filter((i) => i.id !== id);
          if (Array.isArray(root.salesInvoices)) root.salesInvoices = root.salesInvoices.filter((i) => i.id !== id);
        } else if (type === "document") {
          if (Array.isArray(d.technicalDocuments)) d.technicalDocuments = d.technicalDocuments.filter((doc) => doc.id !== id);
          if (Array.isArray(root.technicalDocuments)) root.technicalDocuments = root.technicalDocuments.filter((doc) => doc.id !== id);
        }
        try {
          fs.writeFileSync(BACKUP_CACHE_FILE, JSON.stringify(inMemoryLatestState, null, 2), "utf-8");
          const backupRedundantFile = path.join(process.cwd(), "data_backup_snapshot.backup.json");
          fs.writeFileSync(backupRedundantFile, JSON.stringify(inMemoryLatestState, null, 2), "utf-8");
        } catch (fsErr) {
          console.warn("Failed to write updated backup snapshot after deletion:", fsErr);
        }
      }
      broadcastRealtimeStateUpdate();
      res.json({ success: true, message: "Entity deleted from server snapshot", version: currentServerStateVersion });
    } catch (err) {
      res.status(500).json({ success: false, error: err?.message || "Error deleting entity from server snapshot" });
    }
  });
  app.get("/api/backup/status", (req, res) => {
    const minutesUntilNext = Math.max(0, Math.round((nextScheduledRunTime - Date.now()) / (60 * 1e3)));
    res.json({
      active: true,
      interval: "1 hora (cada 60 minutos)",
      lastBackupTime: lastHourlyBackupTime,
      lastBackupSuccess: lastHourlyBackupSuccess,
      nextScheduledInMinutes: minutesUntilNext,
      defaultRecipients: ["auxlineadiagnostica@syd.com.co", "eljemb22@gmail.com"],
      hasCachedData: Boolean(inMemoryLatestState)
    });
  });
  app.post("/api/backup/email", async (req, res) => {
    try {
      const backupData = req.body;
      const recipients = req.body.recipients || ["auxlineadiagnostica@syd.com.co", "eljemb22@gmail.com"];
      if (backupData && backupData.data) {
        inMemoryLatestState = backupData;
        try {
          fs.writeFileSync(BACKUP_CACHE_FILE, JSON.stringify(backupData, null, 2), "utf-8");
        } catch (e) {
        }
      }
      const result = await sendHourlyBackupEmail(backupData, recipients);
      if (result.success) {
        lastHourlyBackupTime = (/* @__PURE__ */ new Date()).toISOString();
        lastHourlyBackupSuccess = true;
        nextScheduledRunTime = Date.now() + 60 * 60 * 1e3;
      }
      res.json(result);
    } catch (err) {
      console.error("Backup API error:", err);
      res.status(500).json({ success: false, error: err?.message || "Error processing backup" });
    }
  });
  const runServerHourlyBackup = async () => {
    try {
      console.log("[Hourly Backup Service] Initiating scheduled hourly backup...");
      if (!inMemoryLatestState) {
        inMemoryLatestState = readCachedStateSafely();
      }
      if (inMemoryLatestState) {
        const recipients = ["auxlineadiagnostica@syd.com.co", "eljemb22@gmail.com"];
        const result = await sendHourlyBackupEmail(inMemoryLatestState, recipients);
        if (result.success) {
          lastHourlyBackupTime = (/* @__PURE__ */ new Date()).toISOString();
          lastHourlyBackupSuccess = true;
          nextScheduledRunTime = Date.now() + 60 * 60 * 1e3;
          console.log(`[Hourly Backup Service] Successfully executed automated backup to ${recipients.join(", ")}`);
        } else {
          lastHourlyBackupSuccess = false;
          console.warn("[Hourly Backup Service] Email dispatch reported error:", result.error);
        }
      } else {
        console.log("[Hourly Backup Service] No cached database snapshot found yet. Waiting for client sync.");
      }
    } catch (err) {
      console.error("[Hourly Backup Service Error]:", err);
    }
  };
  setInterval(runServerHourlyBackup, 60 * 60 * 1e3);
  const getDownloadFilePath = (filename) => {
    const publicPath = path.join(process.cwd(), "public", "downloads", filename);
    if (fs.existsSync(publicPath)) return publicPath;
    const distPath = path.join(process.cwd(), "dist", "downloads", filename);
    if (fs.existsSync(distPath)) return distPath;
    return null;
  };
  const downloadsDir = fs.existsSync(path.join(process.cwd(), "public", "downloads")) ? path.join(process.cwd(), "public", "downloads") : path.join(process.cwd(), "dist", "downloads");
  app.use("/downloads", express.static(downloadsDir));
  app.get("/api/download/windows-exe", (req, res) => {
    const filePath = getDownloadFilePath("SYD_Colombia.exe");
    if (filePath) {
      res.download(filePath, "SYD_Colombia.exe");
    } else {
      res.status(404).send("Archivo ejecutable no encontrado");
    }
  });
  app.get("/api/download/windows-installer", (req, res) => {
    const filePath = getDownloadFilePath("Instalar_Acceso_Directo.exe");
    if (filePath) {
      res.download(filePath, "Instalar_Acceso_Directo.exe");
    } else {
      res.status(404).send("Instalador no encontrado");
    }
  });
  app.get("/api/download/windows-portable", (req, res) => {
    const filePath = getDownloadFilePath("SYD-Colombia-Portable-Windows.zip");
    if (filePath) {
      res.download(filePath, "SYD-Colombia-Portable-Windows.zip");
    } else {
      res.status(404).send("Paquete portable no encontrado");
    }
  });
  app.get("/api/download/windows-zip", (req, res) => {
    const filePath = getDownloadFilePath("SYD-Colombia-Windows-v1.0.zip");
    if (filePath) {
      res.download(filePath, "SYD-Colombia-Windows-v1.0.zip");
    } else {
      res.status(404).send("Paquete ZIP no encontrado");
    }
  });
  const dirName = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const candidateDirs = [
    path.join(process.cwd(), "dist"),
    path.join(process.cwd(), "build"),
    dirName,
    path.join(dirName, "dist"),
    path.join(dirName, "build"),
    path.join(dirName, "..", "dist"),
    path.join(dirName, "..", "build")
  ];
  const staticDir = candidateDirs.find(
    (dir) => fs.existsSync(path.join(dir, "index.html"))
  );
  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.K_REVISION || process.env.CLOUD_RUN_JOB);
  const shouldServeStatic = Boolean(staticDir) && (process.env.NODE_ENV === "production" || isCloudRun || process.env.SERVE_STATIC === "true" || !process.env.VITE_DEV_MODE);
  if (shouldServeStatic && staticDir) {
    console.log(`[Production/Static] Serving static files from: ${staticDir}`);
    app.use(express.static(staticDir));
    app.get("*", (req, res) => {
      const indexPath = path.join(staticDir, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).send("Error loading application");
        }
      });
    });
  } else {
    try {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
          ws: false
        },
        appType: "spa"
      });
      app.use(vite.middlewares);
      app.use("*", async (req, res, next) => {
        const url = req.originalUrl;
        try {
          const indexPath = path.resolve(process.cwd(), "index.html");
          if (fs.existsSync(indexPath)) {
            let template = fs.readFileSync(indexPath, "utf-8");
            template = await vite.transformIndexHtml(url, template);
            res.status(200).set({ "Content-Type": "text/html" }).end(template);
            return;
          }
          next();
        } catch (e) {
          if (vite) {
            vite.ssrFixStacktrace(e);
          }
          next(e);
        }
      });
    } catch (viteErr) {
      console.error("Failed to initialize Vite dev server, falling back to static handler:", viteErr);
      if (staticDir) {
        app.use(express.static(staticDir));
        app.get("*", (req, res) => {
          res.sendFile(path.join(staticDir, "index.html"));
        });
      }
    }
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`SYD Colombia server running on http://localhost:${PORT}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`
================================================================`);
      console.error(`[AVISO DE PUERTO OCUPADO] El puerto ${PORT} ya est\xE1 en uso.`);
      console.error(`Existe otra sesi\xF3n de Node.js ejecut\xE1ndose en tu computador.`);
      console.error(`Para entrar, abre tu navegador en: http://localhost:${PORT}`);
      console.error(`O cierra el proceso anterior en el Administrador de Tareas.`);
      console.error(`================================================================
`);
      process.exit(1);
    } else {
      console.error("Error al iniciar el servidor:", err);
      process.exit(1);
    }
  });
  const gracefulShutdown = (signal) => {
    console.log(`[${signal}] Cerrando conexiones para apagado o reinicio limpio...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 3e3);
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
startServer();
