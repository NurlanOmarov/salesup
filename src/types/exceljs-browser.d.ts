/**
 * Браузерная UMD-сборка ExcelJS. Импортируем именно её, а не пакет целиком:
 * основная точка входа тянет Node-модули (stream, fs), которых в браузере нет,
 * а dist-сборка самодостаточна.
 *
 * Типы берём у самого пакета — API идентичен.
 */
declare module "exceljs/dist/exceljs.min.js" {
  import type ExcelJS from "exceljs";
  /** UMD: при interop-е бандлер может отдать объект как default, а может — как сам модуль. */
  const value: typeof ExcelJS & { default?: typeof ExcelJS };
  export default value;
  export const Workbook: typeof ExcelJS.Workbook;
}
