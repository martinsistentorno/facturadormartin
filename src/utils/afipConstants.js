export const MONOTRIBUTO_LIMITS = {
  'A': 10277988.13,
  'B': 15058447.71,
  'C': 21113696.52,
  'D': 26212853.42,
  'E': 30833964.37,
  'F': 38642048.36,
  'G': 46211109.37,
  'H': 70113407.33,
  'I': 78479211.62,
  'J': 89872640.30,
  'K': 108357084.05
};

export const getMonotributoLimit = (category) => {
  return MONOTRIBUTO_LIMITS[category] || MONOTRIBUTO_LIMITS['A'];
};
