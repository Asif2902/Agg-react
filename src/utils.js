export function debounce(func, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  }
}

export function formatAddress(addr) {
  if (!addr) return "";
  return addr.substring(0, 6) + '***' + addr.substring(addr.length - 4);
}
