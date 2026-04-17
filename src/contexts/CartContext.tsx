import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export interface CartItem {
  med_id: string;
  med_name: string;
  pharmacy_id: string;
  pharmacy_name: string;
  unit_price: number;
  qty: number;
}

interface CartCtx {
  items: CartItem[];
  add: (i: CartItem) => void;
  remove: (med_id: string, pharmacy_id: string) => void;
  clear: () => void;
  total: number;
}

const Ctx = createContext<CartCtx | undefined>(undefined);
const KEY = "mm_cart_v1";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const add = (i: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((x) => x.med_id === i.med_id && x.pharmacy_id === i.pharmacy_id);
      if (existing) return prev.map((x) => x === existing ? { ...x, qty: x.qty + 1 } : x);
      return [...prev, i];
    });
  };
  const remove = (med_id: string, pharmacy_id: string) =>
    setItems((prev) => prev.filter((x) => !(x.med_id === med_id && x.pharmacy_id === pharmacy_id)));
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + i.unit_price * i.qty, 0);

  return <Ctx.Provider value={{ items, add, remove, clear, total }}>{children}</Ctx.Provider>;
};

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
};
