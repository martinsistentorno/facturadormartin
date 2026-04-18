export const isToday = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

export const isThisWeek = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  
  // Get Monday of the current week
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  return date >= monday;
};

export const isThisMonth = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

export const filterVentasByTimeframe = (ventas, timeframe) => {
  switch (timeframe) {
    case 'day': return ventas.filter(v => isToday(v.fecha));
    case 'week': return ventas.filter(v => isThisWeek(v.fecha));
    case 'month': return ventas.filter(v => isThisMonth(v.fecha));
    default: return ventas; // 'all'
  }
};
