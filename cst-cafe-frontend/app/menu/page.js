"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerNav from "@/components/CustomerNav";
import CafeHeroScene from "../../components/CafeHeroScene";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

// The cart is kept here while a visitor logs in, so it isn't lost.
const CART_KEY = "cst-cafe-cart";

function loadSavedCart() {
  try {
    return JSON.parse(window.sessionStorage.getItem(CART_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCart(quantities) {
  try {
    window.sessionStorage.setItem(CART_KEY, JSON.stringify(quantities));
  } catch {}
}

export default function MenuPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [quantities, setQuantities] = useState({});
  const [cartLoaded, setCartLoaded] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [favourites, setFavourites] = useState([]);

  function loadMenu() {
    return api("/menu")
      .then((data) => {
        setMenuItems(data.items);
        setCategories(data.categories);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMenu();
    setQuantities(loadSavedCart());
    setCartLoaded(true);
  }, []);

  // "Your favourites" - only if the customer turned it on in Privacy settings.
  useEffect(() => {
    if (user?.accountType !== "customer") {
      setFavourites([]);
      return;
    }
    api("/menu/recommendations")
      .then((data) => setFavourites(data.items))
      .catch(() => setFavourites([]));
  }, [user]);

  // Save the cart whenever it changes - but only after the saved cart has
  // been loaded, otherwise the empty starting cart would overwrite it.
  useEffect(() => {
    if (!cartLoaded) return;
    saveCart(quantities);
    setOrderError("");
  }, [quantities, cartLoaded]);

  const visibleItems =
    activeCategory === "All"
      ? menuItems
      : menuItems.filter((item) => item.category === activeCategory);

  function addItem(id) {
    setQuantities((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  function incrementItem(id) {
    setQuantities((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  function decrementItem(id) {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: current - 1 };
    });
  }

  // Only count items that are still on the menu and available.
  const cartLines = Object.entries(quantities)
    .map(([id, qty]) => ({ item: menuItems.find((m) => String(m.id) === id), qty }))
    .filter(({ item, qty }) => item && item.available && qty > 0);
  const totalCount = cartLines.reduce((sum, { qty }) => sum + qty, 0);
  const subtotal = cartLines.reduce((sum, { item, qty }) => sum + item.price * qty, 0);

  async function handleConfirmOrder() {
    if (!user) {
      router.push("/login?next=/menu");
      return;
    }
    if (user.accountType !== "customer") {
      setOrderError("Staff accounts can't place orders. Log in with a customer account.");
      return;
    }
    setPlacing(true);
    try {
      await api("/orders", {
        method: "POST",
        body: { items: cartLines.map(({ item, qty }) => ({ id: item.id, qty })) },
      });
      setQuantities({});
      saveCart({});
      router.push("/orders");
    } catch (err) {
      setOrderError(err.message);
      loadMenu(); // something may have sold out
      setPlacing(false);
    }
  }

  return (
    <>
      <CustomerNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 pb-28">
        <section className="relative mb-10 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-paper to-amber/10 px-6 py-14 text-center sm:px-10">
          <CafeHeroScene className="pointer-events-none absolute inset-0 h-full w-full" />
          <div className="relative z-10 mx-auto max-w-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-amber">
              Welcome to
            </p>
            <h1 className="mt-2 font-display text-5xl leading-tight text-pine sm:text-6xl">
              CST Cafe
            </h1>
            <p className="mt-4 text-muted">
              Order ahead. Skip the line. Browse today&apos;s menu, book a
              table, and place your order before you even leave class.
            </p>
          </div>
        </section>

        {favourites.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl text-pine">Your favourites</h2>
            <p className="mt-0.5 text-sm text-muted">What you order most — add it in one tap.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {favourites.map((fav) => {
                const qty = quantities[fav.id] || 0;
                return (
                  <div
                    key={fav.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{fav.name}</p>
                      <p className="text-xs text-muted">
                        Nu. {fav.price} · ordered {fav.timesOrdered}×
                      </p>
                    </div>
                    <button
                      onClick={() => addItem(fav.id)}
                      aria-label={`Add ${fav.name} from favourites`}
                      className="shrink-0 rounded-full bg-amber px-3 py-1 text-xs text-paper hover:bg-amber-light"
                    >
                      {qty > 0 ? `Add (${qty})` : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="mb-6 flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                activeCategory === cat
                  ? "border-pine bg-pine text-paper"
                  : "border-border text-foreground/70 hover:border-pine/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-muted">Loading menu…</p>}
        {loadError && (
          <p className="rounded-lg border border-delayed/20 bg-delayed/10 px-3 py-2 text-sm text-delayed">
            {loadError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleItems.map((item) => {
            const qty = quantities[item.id] || 0;
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card ${
                  !item.available ? "opacity-50" : ""
                }`}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-amber/10 font-display text-3xl text-amber/60">
                    {item.name.charAt(0)}
                  </div>
                )}
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg text-foreground">
                        {item.name}
                      </h3>
                      <span className="whitespace-nowrap font-display text-lg text-pine">
                        Nu. {item.price}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{item.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted">~{item.prepTime}</span>
                    {item.available ? (
                      qty > 0 ? (
                        <div className="flex items-center gap-3 rounded-full border border-pine/30 bg-pine/5 px-1.5 py-1">
                          <button
                            onClick={() => decrementItem(item.id)}
                            aria-label={`Remove one ${item.name}`}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-pine transition-colors hover:bg-pine/10"
                          >
                            −
                          </button>
                          <span className="w-4 text-center text-sm font-medium text-pine">
                            {qty}
                          </span>
                          <button
                            onClick={() => incrementItem(item.id)}
                            aria-label={`Add one more ${item.name}`}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-pine transition-colors hover:bg-pine/10"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addItem(item.id)}
                          className="rounded-full bg-amber px-4 py-1.5 text-sm text-paper hover:bg-amber-light"
                        >
                          Add to order
                        </button>
                      )
                    ) : (
                      <span className="text-delayed">Sold out</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {totalCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
          {orderError && (
            <p className="mx-auto mb-2 w-full max-w-5xl text-sm text-delayed">{orderError}</p>
          )}
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
            <p className="text-sm text-foreground">
              {totalCount} {totalCount === 1 ? "item" : "items"} ·{" "}
              <span className="font-medium text-pine">Nu. {subtotal}</span>
            </p>
            <button
              onClick={handleConfirmOrder}
              disabled={placing}
              className="rounded-full bg-pine px-6 py-2 text-sm text-paper transition-colors hover:bg-pine/90 disabled:opacity-60"
            >
              {placing ? "Placing order…" : user ? "Confirm order" : "Log in to order"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}