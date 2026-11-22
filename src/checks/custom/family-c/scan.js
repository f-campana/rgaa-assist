/**
 * In-page reader for family C (tree): `custom/2-1-frame-title-attribute`,
 * `custom/6-2-link-content-name`, `custom/11-1-field-label-mechanism`,
 * `custom/11-8-optgroup-label-attribute`.
 *
 * Plain JavaScript because it runs in the page (Playwright serialises the
 * function's source) and the project's TypeScript has no DOM library. Its
 * shape is declared in `scan.d.ts`. It must stay self-contained: no import,
 * no reference to anything outside the function.
 *
 * Read only. It changes nothing in the page except, for elements the
 * caller must look up in the accessibility tree, a list kept under a
 * symbol on `globalThis` (`arg.key`), which the caller deletes when done.
 * The same symbol holds the closed shadow roots the caller registered
 * through CDP before the scan, so that closed trees are read too.
 *
 * Two ways in:
 * - `familyC(arg)` through `frame.evaluate`: scans the frame's document and
 *   every shadow tree in it; returns `ScanResult`.
 * - `familyC(element, arg)` through `elementHandle.evaluate`: describes a
 *   frame element (iframe, frame, object, embed) as the host of a nested
 *   document; returns `HostFacts`.
 */
export function familyC(a, b) {
  const XHTML = "http://www.w3.org/1999/xhtml";
  const SVGNS = "http://www.w3.org/2000/svg";
  const XLINK = "http://www.w3.org/1999/xlink";
  const MATHML = "http://www.w3.org/1998/Math/MathML";
  const hostMode = b !== undefined;
  const arg = hostMode ? b : a;
  const SNIPPET_MAX = arg.snippetMax;

  const key = Symbol.for(arg.key);
  const store = globalThis[key] ?? null;
  const closedRoots = store !== null && store.closed instanceof Map ? store.closed : new Map();

  let rootsCache = null;
  /** The document and every shadow root in it (open, and closed ones registered by the caller). */
  function rootsOf() {
    if (rootsCache !== null) return rootsCache;
    rootsCache = [document];
    for (let i = 0; i < rootsCache.length; i += 1) {
      for (const el of rootsCache[i].querySelectorAll("*")) {
        const sr = shadowOf(el);
        if (sr !== null) rootsCache.push(sr);
      }
    }
    return rootsCache;
  }

  // -------------------------------------------------------------------------
  // Small helpers
  // -------------------------------------------------------------------------

  const asciiLower = (s) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
  const isHtml = (el, name) => el.namespaceURI === XHTML && el.localName === name;
  const nonWs = (s) => typeof s === "string" && /\S/.test(s);
  /** aria-hidden="true", compared as the browser does (ASCII case-insensitive). */
  const ariaHiddenTrue = (el) => {
    const v = el.getAttribute("aria-hidden");
    return v !== null && asciiLower(v) === "true";
  };
  /** First token of the role attribute, ASCII-lowercased; null when absent or blank. */
  const firstRole = (el) => {
    const r = el.getAttribute("role");
    if (r === null) return null;
    const t = r.split(/[\t\n\f\r ]+/).filter((x) => x.length > 0)[0];
    return t === undefined ? null : asciiLower(t);
  };
  const shadowOf = (el) => el.shadowRoot ?? closedRoots.get(el) ?? null;
  const style = (el, pseudo) => getComputedStyle(el, pseudo);

  /** The slot a light child of a shadow host is assigned to, or null. */
  function assignedSlotOf(node) {
    if (node.assignedSlot) return node.assignedSlot;
    const parent = node.parentNode;
    const sr = parent !== null && parent.nodeType === 1 ? shadowOf(parent) : null;
    if (sr === null) return null;
    for (const slot of sr.querySelectorAll("slot")) {
      if (slot.assignedNodes().includes(node)) return slot;
    }
    return null;
  }

  /**
   * Parent in the flat tree. `null` at the top of the document, `undefined`
   * when the node is a light child of a shadow host that no slot takes (it
   * is in no flat tree and has no box).
   */
  function flatParent(node) {
    const p = node.parentNode;
    if (p === null) return null;
    if (p.nodeType === 11) return p.host ?? null;
    if (p.nodeType === 9) return null;
    if (p.nodeType === 1 && shadowOf(p) !== null) {
      const slot = assignedSlotOf(node);
      return slot === null ? undefined : slot;
    }
    return p;
  }

  /** The element and its flat-tree ancestors, nearest first. */
  function chainOf(el) {
    const chain = [];
    let unslotted = false;
    let n = el;
    while (n !== null) {
      chain.push(n);
      const p = flatParent(n);
      if (p === undefined) {
        unslotted = true;
        break;
      }
      n = p;
    }
    return { chain, unslotted };
  }

  /**
   * Not rendered: computed display none on it or a flat-tree ancestor,
   * computed visibility hidden or collapse on it. Also: no box at all
   * (`checkVisibility()` false, for example inside a closed `details` or a
   * light child no slot takes), which is what "not rendered" means.
   */
  function notRendered(el) {
    const v = style(el).visibility;
    if (v === "hidden" || v === "collapse") return true;
    const { chain, unslotted } = chainOf(el);
    if (unslotted) return true;
    for (const n of chain) if (style(n).display === "none") return true;
    if (typeof el.checkVisibility === "function" && !el.checkVisibility()) return true;
    return false;
  }

  function ariaHiddenOnOrAbove(el) {
    return chainOf(el).chain.some((n) => ariaHiddenTrue(n));
  }

  let modalsCache = null;
  function openModals() {
    if (modalsCache !== null) return modalsCache;
    modalsCache = [];
    for (const root of rootsOf()) {
      for (const d of root.querySelectorAll("dialog")) {
        try {
          if (d.matches(":modal")) modalsCache.push(d);
        } catch {
          // `:modal` unsupported: no modal known
        }
      }
    }
    return modalsCache;
  }

  /** inert on it or a flat-tree ancestor, or outside every open modal dialog. */
  function inertOnOrAbove(el) {
    const { chain } = chainOf(el);
    if (chain.some((n) => n.namespaceURI === XHTML && n.hasAttribute("inert"))) return true;
    const modals = openModals();
    if (modals.length > 0 && !modals.some((m) => chain.includes(m))) return true;
    return false;
  }

  function opacityZeroOnOrAbove(el) {
    return chainOf(el).chain.some((n) => Number.parseFloat(style(n).opacity) === 0);
  }

  // -------------------------------------------------------------------------
  // Geometry (11.8 step 2): a part at least 4 px square inside the page's
  // scrollable area and inside every clipping ancestor.
  // -------------------------------------------------------------------------

  /** Three-valued "and": false wins, then null (unknown), then true. */
  const and3 = (x, y) => (x === false || y === false ? false : x === null || y === null ? null : true);

  function parseClipRect(value, box) {
    // `rect(t, r, b, l)` offsets from the border box's top left; `auto` is the edge.
    const m = /^rect\((.*)\)$/.exec(value.trim());
    if (m === null) return null;
    const parts = m[1].split(/\s*,\s*|\s+/).filter((x) => x.length > 0);
    if (parts.length !== 4) return null;
    const num = (s, fallback) => (s === "auto" ? fallback : Number.parseFloat(s));
    const t = num(parts[0], 0);
    const r = num(parts[1], box.width);
    const bt = num(parts[2], box.height);
    const l = num(parts[3], 0);
    if ([t, r, bt, l].some((x) => Number.isNaN(x))) return null;
    return { left: box.left + l, top: box.top + t, right: box.left + r, bottom: box.top + bt };
  }

  function parseInset(value, box) {
    const m = /^inset\(([^)]*)\)$/.exec(value.trim());
    if (m === null) return null;
    // A `round` part rounds the corners: the rectangle then over-states the visible area, so it is not measured (Q60).
    if (/(^|\s)round(\s|$)/.test(m[1])) return null;
    const parts = m[1].split(/\s+/).filter((x) => x.length > 0);
    if (parts.length < 1 || parts.length > 4) return null;
    const [t, r = t, bt = t, l = r] = parts;
    const len = (s, size) => (s.endsWith("%") ? (Number.parseFloat(s) / 100) * size : Number.parseFloat(s));
    const vals = [len(t, box.height), len(r, box.width), len(bt, box.height), len(l, box.width)];
    if (vals.some((x) => Number.isNaN(x))) return null;
    return { left: box.left + vals[3], top: box.top + vals[0], right: box.right - vals[1], bottom: box.bottom - vals[2] };
  }

  /** A clip-path the helper measures: none, or an inset() it parses (Chromium computes rect() and xywh() to inset()). */
  const measuredClipPath = (n, st) => {
    if (!st.clipPath || st.clipPath === "none") return true;
    const nr = n.getBoundingClientRect();
    return parseInset(st.clipPath, { left: nr.left, top: nr.top, right: nr.right, bottom: nr.bottom, width: nr.width, height: nr.height }) !== null;
  };

  const present = (v) => typeof v === "string" && v.trim() !== "" && v.trim() !== "none";

  /** A mask: mask-image (set by the mask shorthand), -webkit-mask-image, -webkit-mask-box-image. */
  const hasMask = (st) => ["mask-image", "-webkit-mask-image", "-webkit-mask-box-image-source"].some((p) => present(st.getPropertyValue(p)));

  /** filter or backdrop-filter, any value but none. */
  const hasFilter = (st) => present(st.filter) || present(st.getPropertyValue("backdrop-filter")) || present(st.getPropertyValue("-webkit-backdrop-filter"));

  /**
   * A transform the bounding rectangle does not fully reflect: anything but
   * an axis-aligned 2D matrix (translation and scale). So rotation, skew, any
   * 3D transform (where backface-visibility and the viewer's position decide
   * what shows), the rotate property, a 3D translate or scale, a motion path.
   */
  function unresolvedTransform(st) {
    const t = st.transform;
    if (present(t)) {
      const m2 = /^matrix\(([^)]*)\)$/.exec(t.trim());
      const m3 = /^matrix3d\(([^)]*)\)$/.exec(t.trim());
      if (m2 !== null) {
        const v = m2[1].split(",").map((x) => Number.parseFloat(x));
        if (v.length !== 6 || v.some((x) => Number.isNaN(x)) || v[1] !== 0 || v[2] !== 0) return true;
      } else if (m3 !== null) {
        const v = m3[1].split(",").map((x) => Number.parseFloat(x));
        if (v.length !== 16 || v.some((x) => Number.isNaN(x))) return true;
        // Column-major: an axis-aligned 2D matrix has only v[0], v[5] (scale) and v[12], v[13] (translation).
        if ([1, 2, 3, 4, 6, 7, 8, 9, 11, 14].some((i) => v[i] !== 0) || v[10] !== 1 || v[15] !== 1) return true;
      } else {
        return true;
      }
    }
    if (present(st.rotate)) return true;
    if (present(st.scale) && st.scale.trim().split(/\s+/).length > 2) return true;
    if (present(st.translate) && st.translate.trim().split(/\s+/).length > 2) return true;
    if (present(st.getPropertyValue("offset-path"))) return true;
    return false;
  }

  /** The frame element's scrolling attribute turns scrolling off (HTML: no, off, noscroll, ASCII case-insensitive). */
  const scrollingOff = (el) =>
    (isHtml(el, "iframe") || isHtml(el, "frame")) && ["no", "off", "noscroll"].includes((el.getAttribute("scrolling") ?? "").trim().toLowerCase());

  /**
   * Which axes of the document's viewport cannot scroll: overflow hidden or
   * clip on the root (or on the body when the root's is visible, as CSS
   * propagates it to the viewport), or a hosting frame element whose
   * scrolling attribute turns scrolling off.
   */
  function viewportLocked(doc, docHost) {
    if (docHost && docHost.frameNoScroll) return { x: true, y: true };
    const root = doc.documentElement;
    if (root === null) return { x: false, y: false };
    const locked = (v) => v === "hidden" || v === "clip";
    const rs = style(root);
    const body = doc.body;
    const bs = body !== null && body.parentNode === root ? style(body) : null;
    const axis = (prop) => (rs[prop] !== "visible" ? locked(rs[prop]) : bs !== null && locked(bs[prop]));
    return { x: axis("overflowX"), y: axis("overflowY") };
  }

  /**
   * Visibility needs positive evidence (Q59). Returns `visible`:
   * - false: no part at least 4 px square lies inside the page's scrollable
   *   area and every clipping ancestor (whatever else applies: hiding only
   *   ever removes area);
   * - null (unknown): the measured part is large enough, but `unmeasured`
   *   names what could still hide it, on the element or a flat-tree ancestor:
   *   `clip-path` (anything but none or a parsed inset()); `off-chain` (a
   *   clip-path, inset() included, or clip on an ancestor outside the
   *   containing-block chain: they clip every descendant, but are measured
   *   only along the chain); `mask`; `filter` (filter or backdrop-filter);
   *   `opacity` (below 1 and above 0; opacity 0 is "not visible", read
   *   separately); `transform` (see `unresolvedTransform`); `fixed` (fixed
   *   to the viewport, with no part 4 px square inside it); `no-scroll` (the
   *   part lies outside the visible part of a viewport that cannot scroll);
   *   `partial-frame` (the viewport cannot scroll and a hosting frame
   *   element is itself shown only in part, so its visible part is not known);
   * - true otherwise.
   * `whole`: nothing cut the element's box (read for frame elements).
   * `docHost`: the host chain of the element's document.
   */
  function geometry(el, docHost) {
    const unmeasured = new Set();
    const r = el.getBoundingClientRect();
    const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    const cut = (c) => {
      box.left = Math.max(box.left, c.left);
      box.top = Math.max(box.top, c.top);
      box.right = Math.min(box.right, c.right);
      box.bottom = Math.min(box.bottom, c.bottom);
    };
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    const se = doc.scrollingElement ?? doc.documentElement;
    const sx = win.scrollX;
    const sy = win.scrollY;
    const sw = Math.max(se.scrollWidth, doc.documentElement.scrollWidth, win.innerWidth);
    const sh = Math.max(se.scrollHeight, doc.documentElement.scrollHeight, win.innerHeight);
    cut({ left: -sx, top: -sy, right: sw - sx, bottom: sh - sy });

    const ownClips = (n, st) => {
      const nr = n.getBoundingClientRect();
      const nbox = { left: nr.left, top: nr.top, right: nr.right, bottom: nr.bottom, width: nr.width, height: nr.height };
      if ((st.position === "absolute" || st.position === "fixed") && st.clip && st.clip !== "auto") {
        const c = parseClipRect(st.clip, nbox);
        if (c !== null) cut(c);
      }
      if (st.clipPath && st.clipPath !== "none") {
        const c = parseInset(st.clipPath, nbox);
        if (c !== null) cut(c);
      }
    };
    // Effects that apply to every descendant whatever its containing block,
    // so they count on every flat-tree ancestor, in the chain or not.
    const effects = (n, st) => {
      if (!measuredClipPath(n, st)) unmeasured.add("clip-path");
      if (hasMask(st)) unmeasured.add("mask");
      if (hasFilter(st)) unmeasured.add("filter");
      const op = Number.parseFloat(st.opacity);
      if (op > 0 && op < 1) unmeasured.add("opacity");
      if (unresolvedTransform(st)) unmeasured.add("transform");
    };

    const own = style(el);
    effects(el, own);
    ownClips(el, own);
    let mode = own.position;
    for (let n = flatParent(el); n !== null && n !== undefined; n = flatParent(n)) {
      if (n.nodeType !== 1) break;
      const st = style(n);
      effects(n, st);
      const fixedCb =
        st.transform !== "none" ||
        st.perspective !== "none" ||
        st.filter !== "none" ||
        /paint|layout|strict|content/.test(st.contain) ||
        /transform|perspective|filter/.test(st.willChange);
      let inChain;
      if (mode === "fixed") inChain = fixedCb;
      else if (mode === "absolute") inChain = st.position !== "static" || fixedCb;
      else inChain = true;
      if (!inChain) {
        const clipped = (st.position === "absolute" || st.position === "fixed") && st.clip && st.clip !== "auto";
        if ((st.clipPath && st.clipPath !== "none") || clipped) unmeasured.add("off-chain");
        continue;
      }
      const nr = n.getBoundingClientRect();
      const left = nr.left + n.clientLeft;
      const top = nr.top + n.clientTop;
      const paint = /paint|strict|content/.test(st.contain);
      if (n !== doc.documentElement && n !== doc.body) {
        if (st.overflowX !== "visible" || paint) {
          box.left = Math.max(box.left, left);
          box.right = Math.min(box.right, left + n.clientWidth);
        }
        if (st.overflowY !== "visible" || paint) {
          box.top = Math.max(box.top, top);
          box.bottom = Math.min(box.bottom, top + n.clientHeight);
        }
      }
      ownClips(n, st);
      mode = st.position;
    }
    const big = (b) => b.right - b.left >= 4 && b.bottom - b.top >= 4;
    if (!big(box)) return { visible: false, unmeasured: [], whole: false };

    // Fixed to the viewport (the containing-block chain ends at it): scrolling
    // never brings a part outside the viewport into view.
    if (mode === "fixed") {
      const seen = { left: Math.max(box.left, 0), top: Math.max(box.top, 0), right: Math.min(box.right, win.innerWidth), bottom: Math.min(box.bottom, win.innerHeight) };
      if (!big(seen)) unmeasured.add("fixed");
    }
    // A viewport that cannot scroll shows only its current visible part.
    const lock = viewportLocked(doc, docHost);
    if (lock.x || lock.y) {
      if (lock.x) cut({ left: 0, top: -Infinity, right: win.innerWidth, bottom: Infinity });
      if (lock.y) cut({ left: -Infinity, top: 0, right: Infinity, bottom: win.innerHeight });
      if (!big(box)) unmeasured.add("no-scroll");
      if (docHost && docHost.partial) unmeasured.add("partial-frame");
    }
    const whole = box.left <= r.left + 0.5 && box.top <= r.top + 0.5 && box.right >= r.right - 0.5 && box.bottom >= r.bottom - 0.5;
    const order = ["clip-path", "off-chain", "mask", "filter", "opacity", "transform", "fixed", "no-scroll", "partial-frame"];
    const list = order.filter((x) => unmeasured.has(x));
    return { visible: list.length > 0 ? null : true, unmeasured: list, whole };
  }

  // -------------------------------------------------------------------------
  // Locators, snippets, descriptors
  // -------------------------------------------------------------------------

  /** Number of elements with each id, per tree (computed once per tree). */
  const idCounts = new Map();
  function uniqueId(root, id) {
    let counts = idCounts.get(root);
    if (counts === undefined) {
      counts = new Map();
      for (const e of root.querySelectorAll("[id]")) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
      idCounts.set(root, counts);
    }
    return counts.get(id) === 1;
  }

  /** `:nth-of-type` position and count of same-type siblings, per parent (computed once per parent). */
  const typePositions = new Map();
  function typePosition(parent, el) {
    let pos = typePositions.get(parent);
    if (pos === undefined) {
      pos = new Map();
      const totals = new Map();
      for (const c of parent.children) {
        const k = c.localName;
        const n = (totals.get(k) ?? 0) + 1;
        totals.set(k, n);
        pos.set(c, n);
      }
      pos.set(null, totals);
      typePositions.set(parent, pos);
    }
    return { index: pos.get(el) ?? 1, same: pos.get(null).get(el.localName) ?? 1 };
  }

  /** CSS selector of an element inside its own tree, memoised per element. */
  const selectors = new Map();
  function selectorIn(el) {
    const known = selectors.get(el);
    if (known !== undefined) return known;
    const tag = CSS.escape(el.localName);
    let sel;
    if (el.id !== "" && uniqueId(el.getRootNode(), el.id)) {
      sel = `${tag}#${CSS.escape(el.id)}`;
    } else {
      const p = el.parentNode;
      if (p === null || p.nodeType === 9) sel = tag;
      else {
        const { index, same } = typePosition(p, el);
        const own = same > 1 ? `${tag}:nth-of-type(${index})` : tag;
        sel = p.nodeType === 1 ? `${selectorIn(p)} > ${own}` : own;
      }
    }
    selectors.set(el, sel);
    return sel;
  }

  /** Shadow hops joined by ` >> ` (as the axe adapter writes them). */
  function locatorOf(el) {
    const segs = [];
    let n = el;
    for (;;) {
      segs.unshift(selectorIn(n));
      const r = n.getRootNode();
      if (r.nodeType === 11 && r.host) n = r.host;
      else break;
    }
    return segs.join(" >> ");
  }

  function snippetOf(el) {
    const h = el.outerHTML ?? "";
    const s = h.length > SNIPPET_MAX ? `${h.slice(0, SNIPPET_MAX)}…` : h;
    return guardEditable(el, s);
  }

  /** A role token in the shared list (arg.textboxRoles, from editable-box.json), as the sanitiser reads the role attribute (Q61). */
  function hasTextboxRole(p) {
    const n = p.getAttributeNames().find((x) => asciiLower(x) === "role");
    if (n === undefined) return false;
    return (p.getAttribute(n) ?? "").split(/[\t\n\f\r ]+/).some((t) => arg.textboxRoles.includes(asciiLower(t)));
  }

  /**
   * An element with an editable ancestor (contenteditable other than false,
   * in the flat tree; a textbox-like role; or designMode on) has its snippet wrapped in that
   * ancestor's start tag, so that the sanitiser masks the text it carries and
   * counts the redaction (Q60).
   */
  function guardEditable(el, html) {
    const outer = editableAncestor(el);
    if (outer !== null) {
      const shell = outer.cloneNode(false).outerHTML;
      return `${shell.slice(0, shell.lastIndexOf("</"))}${html}${shell.slice(shell.lastIndexOf("</"))}`;
    }
    if (documentEditable(el)) return `<div contenteditable="true">${html}</div>`;
    return html;
  }

  /** The outermost editable ancestor of `el` in its own document's flat tree, or null. */
  function editableAncestor(el) {
    let outer = null;
    let node = el;
    for (;;) {
      let p = node.assignedSlot ?? node.parentNode;
      if (p === null || p === undefined) break;
      if (p.nodeType === 11 && p.host) p = p.host;
      if (p.nodeType !== 1) break;
      const v = p.getAttributeNames().find((n) => asciiLower(n) === "contenteditable");
      if (v !== undefined && asciiLower((p.getAttribute(v) ?? "").trim()) !== "false") outer = p;
      else if (hasTextboxRole(p)) outer = p;
      node = p;
    }
    return outer;
  }

  /** The element's document is in designMode, or sits inside an editable box through its hosting frame chain (Q63; arg.host.editable, true when unknown). */
  function documentEditable(el) {
    return String(el.ownerDocument.designMode).toLowerCase() === "on" || arg.host.editable === true;
  }

  /** What the element is, without page-specific ids: for fingerprints. */
  function descriptorOf(el) {
    let d = el.localName;
    if (isHtml(el, "input")) {
      const t = el.getAttribute("type");
      if (t !== null) d += `[type=${asciiLower(t)}]`;
    }
    const role = firstRole(el);
    if (role !== null) d += `[role=${role}]`;
    if ((isHtml(el, "iframe") || isHtml(el, "frame")) && el.getAttribute("src")) {
      try {
        const u = new URL(el.getAttribute("src"), el.baseURI);
        d += `[src=${u.origin}${u.pathname}]`;
      } catch {
        // unparsable src: left out
      }
    }
    const classes = Array.from(el.classList ?? []).slice(0, 2);
    if (classes.length > 0) d += `.${classes.join(".")}`;
    return d;
  }

  // -------------------------------------------------------------------------
  // Host mode: facts about a frame element that hosts a nested document.
  // -------------------------------------------------------------------------

  if (hostMode) {
    const el = a;
    const g = geometry(el, arg.host);
    return {
      editable: editableAncestor(el) !== null || documentEditable(el),
      locator: locatorOf(el),
      notRendered: notRendered(el),
      ariaHidden: ariaHiddenOnOrAbove(el),
      inert: inertOnOrAbove(el),
      opacityZero: opacityZeroOnOrAbove(el),
      visible: g.visible,
      unmeasured: g.unmeasured,
      whole: g.whole,
      noScroll: scrollingOff(el),
    };
  }

  // -------------------------------------------------------------------------
  // Scan mode
  // -------------------------------------------------------------------------

  const host = arg.host;
  const axList = [];
  const askAx = (el) => {
    axList.push(el);
    return axList.length - 1;
  };

  const base = (el) => ({ locator: locatorOf(el), snippet: snippetOf(el), descriptor: descriptorOf(el) });

  // --- 2.1.1: frame elements ------------------------------------------------
  function scanFrames() {
    const out = [];
    for (const root of rootsOf()) {
      for (const el of root.querySelectorAll("iframe, frame")) {
        if (el.namespaceURI !== XHTML) continue;
        const title = el.getAttribute("title");
        const rec = { ...base(el), title: title === null ? "absent" : nonWs(title) ? "text" : "blank" };
        if (rec.title === "absent") {
          rec.ariaHidden = host.ariaHidden || ariaHiddenOnOrAbove(el);
          rec.notRendered = host.notRendered || notRendered(el);
          rec.inert = host.inert || inertOnOrAbove(el);
          rec.ax = !rec.ariaHidden && !rec.notRendered && !rec.inert && host.known ? askAx(el) : null;
        }
        out.push(rec);
      }
    }
    return out;
  }

  // --- 6.2.1: links -----------------------------------------------------------
  const BLOCKING_HTML = new Set(["object", "embed", "canvas", "iframe", "video", "audio", "math", "select", "textarea", "button", "output", "meter", "progress"]);
  const SVG_NOT_CONTENT = new Set(["title", "desc", "metadata", "style", "script"]);

  function isBlocking(el) {
    if (el.namespaceURI === MATHML && el.localName === "math") return true;
    if (el.namespaceURI !== XHTML) return false;
    if (BLOCKING_HTML.has(el.localName)) return true;
    if (el.localName === "input") {
      const t = el.getAttribute("type");
      return t === null || asciiLower(t) !== "hidden";
    }
    return false;
  }

  /** Text of the elements an aria-labelledby names, in the element's own tree. */
  function labelledby(el) {
    const v = el.getAttribute("aria-labelledby");
    if (v === null) return { present: false, text: "", complex: false };
    const root = el.getRootNode();
    let text = "";
    let complex = false;
    for (const id of v.split(/[\t\n\f\r ]+/).filter((x) => x.length > 0)) {
      const ref = typeof root.getElementById === "function" ? root.getElementById(id) : null;
      if (ref === null) continue;
      const t = ref.textContent ?? "";
      text += ` ${t}`;
      if (!nonWs(t) && ref.querySelector("img, svg, object, canvas, input, select, textarea, [role]") !== null) complex = true;
    }
    return { present: true, text, complex };
  }

  /** Text alternative of an image: aria-labelledby, then aria-label, then alt, then title. */
  function imageAlternative(el) {
    const lb = labelledby(el);
    if (nonWs(lb.text)) return { text: lb.text, uncomputed: false };
    for (const name of ["aria-label", "alt", "title"]) {
      const v = el.getAttribute(name);
      if (nonWs(v)) return { text: v, uncomputed: false };
    }
    return { text: "", uncomputed: lb.complex };
  }

  function directSvgTitle(el) {
    for (const c of el.children) if (c.namespaceURI === SVGNS && c.localName === "title") return c.textContent ?? "";
    return "";
  }

  /** Inline svg: aria-labelledby, aria-label or child title. */
  function svgAlternative(el) {
    const lb = labelledby(el);
    if (nonWs(lb.text)) return { text: lb.text, uncomputed: false };
    const al = el.getAttribute("aria-label");
    if (nonWs(al)) return { text: al, uncomputed: false };
    const t = directSvgTitle(el);
    if (nonWs(t)) return { text: t, uncomputed: false };
    return { text: "", uncomputed: lb.complex };
  }

  function flatChildren(el) {
    const sr = shadowOf(el);
    if (sr !== null) return Array.from(sr.childNodes);
    if (el.localName === "slot" && typeof el.assignedNodes === "function" && el.getRootNode().nodeType === 11) {
      const assigned = el.assignedNodes();
      return assigned.length > 0 ? assigned : Array.from(el.childNodes);
    }
    return Array.from(el.childNodes);
  }

  /** The name a link gets from its content alone (record of 6.2.1). */
  function contentName(link, svgLink) {
    let text = "";
    let blocking = false;
    let altUncomputed = false;
    if (svgLink) text += directSvgTitle(link);
    const visit = (node, container) => {
      if (node.nodeType === 3) {
        // RECORD: 6.2.1 says to skip a subtree whose root has computed visibility hidden or collapse.
        // A descendant with visibility visible is still rendered and exposed there, so the check
        // skips only text whose own element is not visible. This can only remove faults.
        const v = style(container).visibility;
        if (v !== "hidden" && v !== "collapse") text += node.data;
        return;
      }
      if (node.nodeType !== 1) return;
      const el = node;
      if (ariaHiddenTrue(el) || el.hasAttribute("hidden") || style(el).display === "none") return;
      if (el.namespaceURI === SVGNS && SVG_NOT_CONTENT.has(el.localName)) return;
      if (isBlocking(el)) {
        blocking = true;
        return;
      }
      const role = firstRole(el);
      if (isHtml(el, "img") || role === "img" || role === "image") {
        const alt = imageAlternative(el);
        text += ` ${alt.text}`;
        if (alt.uncomputed) altUncomputed = true;
      } else if (el.namespaceURI === SVGNS && el.localName === "svg") {
        const alt = svgAlternative(el);
        text += ` ${alt.text}`;
        if (alt.uncomputed) altUncomputed = true;
      }
      for (const c of flatChildren(el)) visit(c, el);
    };
    for (const c of flatChildren(link)) visit(c, link);
    return { text, blocking, altUncomputed };
  }

  function nameClass(text) {
    let any = false;
    for (const ch of text) {
      if (/\s/.test(ch)) continue;
      any = true;
      const cp = ch.codePointAt(0);
      const pua = (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd) || (cp >= 0x100000 && cp <= 0x10fffd);
      if (!pua) return "name";
    }
    return any ? "pua" : "empty";
  }

  function hasGeneratedContent(el) {
    const check = (n) => {
      for (const pe of ["::before", "::after"]) {
        const c = style(n, pe).content;
        if (c && c !== "none" && c !== "normal") return true;
      }
      return false;
    };
    const walk = (n) => {
      if (check(n)) return true;
      for (const c of flatChildren(n)) if (c.nodeType === 1 && walk(c)) return true;
      return false;
    };
    return walk(el);
  }

  function attributeName(el) {
    if (nonWs(labelledby(el).text)) return true;
    if (nonWs(el.getAttribute("aria-label"))) return true;
    if (nonWs(el.getAttribute("title"))) return true;
    if (nonWs(el.getAttributeNS(XLINK, "title")) || nonWs(el.getAttribute("xlink:title"))) return true;
    return false;
  }

  function scanLinks() {
    const out = [];
    for (const root of rootsOf()) {
      for (const el of root.querySelectorAll("a, [role]")) {
        const htmlA = isHtml(el, "a") && el.hasAttribute("href");
        const svgA =
          el.namespaceURI === SVGNS &&
          el.localName === "a" &&
          (el.hasAttribute("href") || el.hasAttributeNS(XLINK, "href") || el.hasAttribute("xlink:href"));
        const roleLink = firstRole(el) === "link";
        if (!htmlA && !svgA && !roleLink) continue;
        const c = contentName(el, svgA);
        const rec = { ...base(el), name: nameClass(c.text), isAnchorWithHref: htmlA || svgA };
        if (rec.name !== "name") {
          rec.notRendered = host.notRendered || notRendered(el);
          rec.ariaHidden = host.ariaHidden || ariaHiddenOnOrAbove(el);
          rec.inert = host.inert || inertOnOrAbove(el);
          rec.blocking = c.blocking;
          rec.altUncomputed = c.altUncomputed;
          rec.generated = hasGeneratedContent(el);
          rec.attributeName = attributeName(el);
          // The accessibility tree is asked only for a link that steps (3) to (5) would not take:
          // for any other, steps (2) to (5) all give cannot_tell and the look-up changes nothing.
          const wouldFault =
            rec.isAnchorWithHref && rec.name === "empty" && !c.blocking && !c.altUncomputed && !rec.generated && !rec.attributeName;
          rec.ax = wouldFault && !rec.notRendered && !rec.ariaHidden && !rec.inert && host.known ? askAx(el) : null;
        }
        out.push(rec);
      }
    }
    return out;
  }

  // --- 11.1.1: form fields ----------------------------------------------------
  const FIELD_TYPES = new Set(["text", "password", "search", "email", "number", "tel", "url", "checkbox", "radio", "date", "range", "color", "time", "month", "week", "datetime-local", "file"]);
  const SKIP_TYPES = new Set(["submit", "reset", "hidden", "image", "button"]);
  const FIELD_ROLES = new Set(["progressbar", "slider", "spinbutton", "textbox", "listbox", "searchbox", "combobox"]);
  const NEVER_ROLES = new Set(["option", "checkbox", "radio", "switch"]);
  const FIELD_TAGS = new Set(["input", "textarea", "select", "output", "progress", "meter"]);

  const comboRefsByRoot = new Map();
  /** Ids named by aria-controls or aria-owns of a combobox, in one tree. */
  function comboRefs(root) {
    let set = comboRefsByRoot.get(root);
    if (set !== undefined) return set;
    set = new Set();
    for (const el of root.querySelectorAll("[aria-controls], [aria-owns]")) {
      // A combobox: an explicit role=combobox, or an <input list> (its implicit role).
      if (firstRole(el) !== "combobox" && !(isHtml(el, "input") && el.hasAttribute("list"))) continue;
      for (const name of ["aria-controls", "aria-owns"]) {
        for (const t of (el.getAttribute(name) ?? "").split(/[\t\n\f\r ]+/)) if (t.length > 0) set.add(t);
      }
    }
    comboRefsByRoot.set(root, set);
    return set;
  }

  function containsInput(el) {
    const has = (r) => Array.from(r.querySelectorAll("input")).some((i) => i.namespaceURI === XHTML);
    if (has(el)) return true;
    const sr = shadowOf(el);
    return sr !== null && has(sr);
  }

  /** "skip", "never:<why>", "field", or null when the element is none of these. */
  function fieldClass(el) {
    const html = el.namespaceURI === XHTML;
    const ln = el.localName;
    const role = firstRole(el);
    let type = null;
    if (html && ln === "input") {
      const t = el.getAttribute("type");
      type = t === null ? null : asciiLower(t);
      if (type !== null && SKIP_TYPES.has(type)) return "skip";
    }
    if (html && ln === "button") return "skip";
    if (role === "button") return "skip";
    if (html && ln === "input" && type !== null && !FIELD_TYPES.has(type)) return "never:input of another type";
    if (html && (ln === "option" || ln === "optgroup" || ln === "datalist")) return `never:${ln}`;
    if (role !== null && NEVER_ROLES.has(role)) return `never:role ${role}`;
    if (role === "combobox" && containsInput(el)) return "never:role combobox containing an input";
    if (role === "listbox" && el.id !== "" && comboRefs(el.getRootNode()).has(el.id)) return "never:role listbox controlled or owned by a combobox";
    if (html && FIELD_TAGS.has(ln)) return "field";
    if (role !== null && FIELD_ROLES.has(role)) return "field";
    return null;
  }

  function labelForInTree(el) {
    if (el.id === "") return false;
    for (const l of el.getRootNode().querySelectorAll("label")) {
      if (l.namespaceURI === XHTML && l.getAttribute("for") === el.id) return true;
    }
    return false;
  }

  function scanFields() {
    const out = [];
    const sel = "input, textarea, select, output, progress, meter, option, optgroup, datalist, button, [role]";
    for (const root of rootsOf()) {
      for (const el of root.querySelectorAll(sel)) {
        const cls = fieldClass(el);
        if (cls === null || cls === "skip") continue;
        const rec = { ...base(el), cls };
        if (cls === "field") {
          // RECORD: 11.1.1 step (1) names display none, visibility, aria-hidden and inert "on it or an
          // ancestor" without mentioning frames. A field inside a frame element that is not rendered,
          // aria-hidden or inert is treated as if that frame element were an ancestor (as 2.1.1 and
          // 6.2.1 state). This can only remove faults.
          rec.notRendered = host.notRendered || notRendered(el);
          rec.ariaHidden = host.ariaHidden || ariaHiddenOnOrAbove(el);
          rec.inert = host.inert || inertOnOrAbove(el);
          const labels = el.labels;
          rec.mechanisms = {
            ariaLabelledby: el.hasAttribute("aria-labelledby"),
            ariaLabel: el.hasAttribute("aria-label"),
            title: el.hasAttribute("title"),
            labelsList: (labels !== undefined && labels !== null && labels.length > 0) || labelForInTree(el),
            labelAncestor: chainOf(el).chain.slice(1).some((n) => isHtml(n, "label")),
          };
        }
        out.push(rec);
      }
    }
    return out;
  }

  // --- 11.8.2: optgroups ------------------------------------------------------
  function inForm(select) {
    const { chain } = chainOf(select);
    for (const n of chain.slice(1)) {
      if (isHtml(n, "form")) return true;
      if (firstRole(n) === "form") return true;
    }
    return select.form !== null && select.form !== undefined;
  }

  function scanOptgroups() {
    const selects = [];
    const index = new Map();
    const groups = [];
    for (const root of rootsOf()) {
      for (const o of root.querySelectorAll("optgroup")) {
        if (!isHtml(o, "optgroup")) continue;
        let s = o.parentElement;
        while (s !== null && !isHtml(s, "select")) s = s.parentElement;
        if (s === null) continue;
        let si = index.get(s);
        if (si === undefined) {
          const rec = {
            locator: locatorOf(s),
            snippet: snippetOf(s).slice(0, 200),
            inForm: inForm(s),
            notRendered: host.notRendered || notRendered(s),
            ariaHidden: host.ariaHidden || ariaHiddenOnOrAbove(s),
            inert: host.inert || inertOnOrAbove(s),
            opacityZero: host.opacityZero || opacityZeroOnOrAbove(s),
            visible: true,
            unmeasured: [],
            ax: null,
          };
          const g = geometry(s, host);
          rec.visible = and3(host.visible, g.visible);
          rec.unmeasured = rec.visible === null ? [...new Set([...host.unmeasured, ...g.unmeasured])] : [];
          if (rec.inForm && !rec.notRendered && !rec.ariaHidden && !rec.inert && !rec.opacityZero && rec.visible && host.known) rec.ax = askAx(s);
          si = selects.length;
          selects.push(rec);
          index.set(s, si);
        }
        groups.push({
          ...base(o),
          snippet: (o.outerHTML ?? "").split(">")[0] + ">",
          select: si,
          parentIsSelect: o.parentNode === s,
          hiddenAttr: o.hasAttribute("hidden"),
          displayNone: style(o).display === "none",
          ariaHidden: ariaHiddenTrue(o),
          inertAttr: o.hasAttribute("inert"),
          legendChild: Array.from(o.children).some((c) => isHtml(c, "legend")),
          hasLabel: o.hasAttribute("label"),
        });
      }
    }
    return { selects, groups };
  }

  const run = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  };

  const result = {
    url: document.URL,
    frames: run(scanFrames),
    links: run(scanLinks),
    fields: run(scanFields),
    optgroups: run(scanOptgroups),
    axCount: axList.length,
  };
  if (axList.length > 0) {
    const s = globalThis[key] ?? (globalThis[key] = {});
    s.ax = axList;
    s.frameIndex = arg.frameIndex;
  }
  return result;
}
