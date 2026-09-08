// Mock API endpoints for a purely client-side artifact without a backend.
export const listBlotter = async () => {
  return [
    { handle: "GULL-0001", score: 1000000, combo: 100 },
    { handle: "GULL-B055", score: 500000, combo: 50 },
    { handle: "GULL-N00B", score: 100, combo: 1 },
  ];
};

export const postBlotter = async (payload: { data: { handle: string; score: number; combo: number } }) => {
  void payload;
  return { ok: true as const };
};

export const startPatronCheckout = async (payload: { data: { origin: string } }) => {
  return { url: null as string | null, preview: true, error: undefined as string | undefined };
};
