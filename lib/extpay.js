// ExtensionPay wrapper (placeholder ID)
import './extpay.vendor.js';

const EXT_PAY_ID = 'stockpile---download-organizer';
let cachedExtPay = null;

function getExtPay() {
  if (cachedExtPay) return cachedExtPay;
  if (typeof globalThis.ExtPay === 'function') {
    cachedExtPay = globalThis.ExtPay(EXT_PAY_ID);
    return cachedExtPay;
  }
  return null;
}

export async function initExtPayBackground() {
  const extpay = getExtPay();
  if (extpay && typeof extpay.startBackground === 'function') {
    try {
      await extpay.startBackground();
    } catch (error) {
      console.warn('[Stockpile] ExtPay startBackground failed:', error);
    }
  }
  return extpay;
}

export async function getPaidStatus() {
  const extpay = getExtPay();
  if (!extpay || typeof extpay.getUser !== 'function') {
    return { paid: false, reason: 'extpay_unavailable' };
  }

  try {
    const user = await extpay.getUser();
    return { paid: !!user?.paid, user };
  } catch (error) {
    console.warn('[Stockpile] ExtPay getUser failed:', error);
    return { paid: false, reason: 'extpay_failed', error };
  }
}

export function openPaymentPage() {
  const extpay = getExtPay();
  if (extpay && typeof extpay.openPaymentPage === 'function') {
    try {
      extpay.openPaymentPage();
      return true;
    } catch (error) {
      console.warn('[Stockpile] ExtPay openPaymentPage failed:', error);
    }
  }
  return false;
}

export function openLoginPage() {
  const extpay = getExtPay();
  if (extpay && typeof extpay.openLoginPage === 'function') {
    try {
      extpay.openLoginPage();
      return true;
    } catch (error) {
      console.warn('[Stockpile] ExtPay openLoginPage failed:', error);
    }
  }
  return false;
}

export function onPaid(callback) {
  const extpay = getExtPay();
  if (extpay && typeof extpay.onPaid === 'function' && typeof callback === 'function') {
    extpay.onPaid(callback);
  }
}
