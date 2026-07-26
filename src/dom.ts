/**
 * A ~40-line replacement for a UI framework.
 *
 * The whole site is tables, bars and SVG — none of it needs a virtual DOM, and
 * shipping one would cost more than every other asset combined. `h` covers
 * element creation; `svg` does the same in the SVG namespace, which is the one
 * thing `innerHTML` cannot fake.
 */

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

function apply(node: Element, attrs: Attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.setAttribute('class', String(value));
    else if (key === 'style' && typeof value === 'object') {
      Object.assign((node as HTMLElement).style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'html') node.innerHTML = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'data' && typeof value === 'object') {
      for (const [d, v] of Object.entries(value as object)) {
        if (v != null) node.setAttribute(`data-${d}`, String(v));
      }
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
}

function append(node: Element, children: Child[]) {
  for (const child of children.flat(3) as Child[]) {
    if (child == null || child === false || child === '') continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  apply(node, attrs);
  append(node, children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag: string, attrs: Attrs = {}, ...children: Child[]): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  apply(node, attrs);
  append(node, children);
  return node;
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);

/** Replace a container's contents in one shot. */
export function mount(target: Element | null, ...children: Child[]) {
  if (!target) return;
  target.replaceChildren();
  append(target, children);
}

/** Trailing-edge debounce, for search input and window resize. */
export function debounce<F extends (...args: never[]) => void>(fn: F, ms = 120) {
  let timer: number | undefined;
  return (...args: Parameters<F>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms) as unknown as number;
  };
}

/** Escape text destined for a `title` attribute or tooltip body. */
export const esc = (s: unknown) => String(s ?? '');
