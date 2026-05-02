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

export const isThisYear = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.getFullYear() === today.getFullYear();
};

export const filterVentasByTimeframe = (ventas, timeframe, customRange) => {
  if (timeframe === 'custom' && customRange?.from && customRange?.to) {
    return filterVentasByDateRange(ventas, customRange.from, customRange.to);
  }
  switch (timeframe) {
    case 'day': return ventas.filter(v => isToday(v.fecha));
    case 'week': return ventas.filter(v => isThisWeek(v.fecha));
    case 'month': return ventas.filter(v => isThisMonth(v.fecha));
    case 'year': return ventas.filter(v => isThisYear(v.fecha));
    default: return ventas; // 'all'
  }
};

export const filterVentasByDateRange = (ventas, from, to) => {
  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);
  return ventas.filter(v => {
    if (!v.fecha) return false;
    const d = new Date(v.fecha);
    return d >= fromDate && d <= toDate;
  });
};

// Returns the equivalent previous period for comparison
export const getComparisonRange = (from, to) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffMs = toDate - fromDate;
  const compTo = new Date(fromDate.getTime() - 1); // day before "from"
  const compFrom = new Date(compTo.getTime() - diffMs);
  return {
    from: compFrom.toISOString().split('T')[0],
    to: compTo.toISOString().split('T')[0],
  };
};

// Get the date range for a given timeframe preset
export const getTimeframeRange = (timeframe) => {
  const today = new Date();
  const to = today.toISOString().split('T')[0];
  
  switch (timeframe) {
    case 'day':
      return { from: to, to };
    case 'week': {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today);
      monday.setDate(diff);
      return { from: monday.toISOString().split('T')[0], to };
    }
    case 'month': {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: firstOfMonth.toISOString().split('T')[0], to };
    }
    case 'year': {
      return { from: `${today.getFullYear()}-01-01`, to };
    }
    default:
      return null; // 'all' has no bounded range
  }
};
