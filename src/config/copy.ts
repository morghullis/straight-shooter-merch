/**
 * Every user-facing string that is not brand content (that lives in site.ts / fans.ts).
 * Components never inline copy, so translating the store or changing the voice is a
 * single-file job.
 */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const copy = {
  a11y: {
    skipToContent: "Skip to content",
    primaryNav: "Primary",
    mobileNav: "Mobile",
    breadcrumb: "Breadcrumb",
    openInNewTab: "(opens in a new tab)",
  },

  header: {
    home: (brand: string) => `${brand} home`,
    search: "Search",
    searchStore: "Search the store",
    searchPlaceholder: "Search hoodies, hats, tees…",
    closeSearch: "Close search",
    account: "Account",
    openCart: (count: number) => `Open cart, ${count} ${plural(count, "item", "items")}`,
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menuCta: "Shop all merch",
    menuFootnote: "Official merch. Straight talk, real fans.",
  },

  cart: {
    dialog: "Shopping cart",
    title: "Your Cart",
    close: "Close cart",
    emptyTitle: "Your cart is empty",
    emptyBody: "Straight talk, real fans. Go find something to wear.",
    emptyCta: "Shop all merch",
    remove: "Remove",
    decrease: (title: string) => `Decrease quantity of ${title}`,
    increase: (title: string) => `Increase quantity of ${title}`,
    subtotal: "Subtotal",
    note: "Shipping and taxes are calculated at checkout.",
    checkout: "Checkout",
    checkingOut: "Starting checkout…",
  },

  product: {
    addToCart: "Add to cart",
    soldOut: "Sold out",
    added: (qty: number, title: string) => `${qty} × ${title} added to cart`,
    decrease: "Decrease quantity",
    increase: "Increase quantity",
    mediaGroup: "Media type",
    photo: "Photo",
    threeD: "3D",
    dragToSpin: "Drag to spin",
    viewImage: (n: number) => `Show image ${n}`,
    onModel: "On model",
    angles: {
      front: "Front view",
      "quarter-right": "Three-quarter view, right",
      "side-right": "Right side view",
      back: "Back view",
      "side-left": "Left side view",
      "quarter-left": "Three-quarter view, left",
      "quarter-back-right": "Back three-quarter view, right",
      "quarter-back-left": "Back three-quarter view, left",
    },
    viewAlt: (title: string, view: string) => `${title}, ${view.toLowerCase()}`,
    previousView: "Previous view",
    nextView: "Next view",
    viewCount: (n: number, total: number) => `View ${n} of ${total}`,
    galleryOf: (title: string) => `${title}, product views`,
    sizes: "Sizes",
    related: "You may also like",
    home: "Home",
    shopAll: "Shop all",
    details: [
      "Official licensed merch",
      "Ships from our fulfilment partner",
      "Shipping and delivery estimates are shown at checkout",
    ],
  },

  collection: {
    all: "All",
    count: (n: number) => `${n} ${plural(n, "product", "products")}`,
    empty: "Nothing here yet. Check back soon.",
    filter: "Collections",
  },

  search: {
    title: "Search",
    prompt: "Type something in the search bar to find hoodies, hats, tees and more.",
    none: (q: string) => `No results for “${q}”.`,
    results: (n: number, q: string) => `${n} ${plural(n, "result", "results")} for “${q}”`,
    cta: "Shop all merch",
  },

  account: {
    title: "My account",
    ordersTitle: "Orders & sign in",
    ordersBody: "Sign in to view past orders, track shipments and manage your details.",
    signIn: "Sign in",
    createAccount: "Create account",
    howItWorks: "No password to remember: enter your email and we send you a code. New here? The same step creates your account.",
    notConnected: "Customer accounts are not connected yet: set SHOPIFY_STORE_DOMAIN (see docs/SHOPIFY.md).",
    signInErrors: {
      cancelled: "Sign in was cancelled. Try again whenever you like.",
      expired: "That sign-in took too long. Please try again.",
      failed: "We couldn't sign you in just now. Please try again.",
    },
    greeting: (name: string) => (name ? `Hi, ${name}` : "Your account"),
    ordersHeading: "Your orders",
    noOrders: "No orders yet. Your first one will show up here.",
    trackOrder: "Track order",
    status: {
      cancelled: "Cancelled",
      fulfillment: {
        FULFILLED: "Shipped",
        PARTIALLY_FULFILLED: "Partly shipped",
        UNFULFILLED: "Processing",
        IN_PROGRESS: "Processing",
        ON_HOLD: "On hold",
        SCHEDULED: "Scheduled",
        RESTOCKED: "Returned",
      },
    },
    manage: "Addresses & details",
    signOut: "Sign out",
    shippingTitle: "Shipping & returns",
    shippingBody: "Shipping options and delivery estimates are shown at checkout. Replace this text with your store policy.",
    contactTitle: "Contact",
    contactBody: (brand: string) => `Questions about an order? Reach out to ${brand} support from your order confirmation email.`,
  },

  errors: {
    notFoundKicker: "Error 404",
    notFoundTitle: ["Off the", "record."],
    notFoundBody: "That page doesn't exist. Straight talk: it may have moved, or the link is wrong.",
    notFoundCta: "Shop all merch",
    errorKicker: "Something broke",
    errorTitle: "We fumbled that one.",
    errorBody: "The page hit an unexpected error. Try again, and if it keeps happening let us know.",
    retry: "Try again",
  },

  footer: {
    tagline: "Straight talk. Real fans. Official merch.",
    officialTitle: "Official merch",
    officialBody: "Every order ships from our fulfilment partner. Questions about an order? Reach out from your account page.",
    account: "My account",
    rights: "All rights reserved.",
  },

  showroom: {
    kicker: "Showroom",
    title: "The Showroom",
    lead: "Every piece, in 3D. Scroll for the next one, drag to take a closer look.",
    piece: (n: number, total: number) => `Piece ${String(n).padStart(2, "0")} of ${String(total).padStart(2, "0")}`,
    shop: "Shop it",
    scrollHint: "Scroll",
    goTo: (label: string) => `Go to ${label}`,
    stage: (title: string) => `Interactive 3D view of ${title}. Drag to rotate.`,
    loading3d: "Loading 3D view",
    pickLabel: "Choose a product to view in 3D",
  },

  marquee: {
    label: "Catchphrases",
  },

  rundown: {
    kicker: "For the fans",
    title: ["Pick your", "lane."],
    lead: "Sports, politics, culture. One voice, three ways to tune in. Find your show, catch it live, then wear the take.",
    studioPass: "Studio pass",
    channel: "CH",
    onAirNow: "On air now",
    liveIn: (t: string) => `Live in ${t}`,
    daysLabel: "Airs on",
    where: "Where",
    when: "When",
    podcast: "Podcast",
  },

  quiz: {
    kicker: "Official ballot",
    title: "Which fan are you?",
    question: (n: number, total: number) => `Question ${n} of ${total}`,
    yourLane: "Your lane",
    result: "Official result",
    retake: "Retake the quiz",
  },

  crew: {
    kicker: "Season pass",
    title: ["First to know.", "First to wear."],
    lead: "Drop alerts and early access, straight to your inbox. No spam, just the merch.",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    submit: "Join the crew",
    submitting: "Joining…",
    consent: "By joining you agree to receive drop alerts. Unsubscribe any time.",
    honeypot: "Company",
    listen: "Catch the shows live on",
    listenLink: "SiriusXM",
    admit: "Admit one fan",
  },
} as const;
