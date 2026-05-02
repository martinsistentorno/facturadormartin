export const MONOTRIBUTO_LIMITS_2024 = {
  'A': 6450000,
  'B': 9450000,
  'C': 13250000,
  'D': 16450000,
  'E': 19350000,
  'F': 24250000,
  'G': 29000000,
  'H': 44000000,
  'I': 49250000,
  'J': 56400000,
  'K': 68000000
};

// Se puede cambiar la referencia cuando AFIP publique la de 2025/2026
export const getMonotributoLimit = (category) => {
  return MONOTRIBUTO_LIMITS_2024[category] || MONOTRIBUTO_LIMITS_2024['A'];
};
