/**
 * Ссылки в магазин activesales.by (docs/WOO-INTEGRATION.md).
 *
 * Отдельный модуль без "use client": ссылку строит серверный компонент страницы
 * курса, а вызвать функцию, объявленную в клиентском модуле, он не может.
 */

/**
 * «Купить»: кладёт товар в корзину магазина и сразу открывает оформление,
 * чтобы человек не искал курс среди трёх десятков позиций каталога.
 */
export function shopCheckoutUrl(storeUrl: string, wooProductId: number): string {
  return `${storeUrl.replace(/\/$/, "")}/cart/?add-to-cart=${wooProductId}`;
}
