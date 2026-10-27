/**
 * JSX runtime for zplkit. TypeScript and bundlers load this module when a
 * project sets `"jsx": "react-jsx"` and `"jsxImportSource": "@zplkit/core"`.
 *
 * Elements have the same shape as React's, `{ type, props, key }`, and
 * components are not called until build() walks the tree. That means labels
 * also work when compiled by React's own runtime, and the same element can be
 * reused in labels with different resolutions, since millimeters are
 * converted to dots only once the element ends up in a label.
 */

type ZplElement = {
  // `any` keeps elements structurally compatible with React's element type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: (props: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any;
  key: string | null;
};

/** Anything that can appear as a child of <Label> */
type ZplNode = ZplElement | ZplNode[] | boolean | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsx = <P>(
  type: (props: P) => unknown,
  props: P,
  key?: string | number
): ZplElement => ({
  type,
  props,
  key: key === undefined ? null : String(key),
});

const Fragment = (props: { children?: ZplNode }): ZplElement =>
  jsx(Fragment, props);

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace JSX {
  type Element = ZplElement;
  // Only function components are supported, there are no built-in tags
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntrinsicElements {}
  // Accepted on every element so lists can be written as in React; unused
  interface IntrinsicAttributes {
    key?: string | number;
  }
  interface ElementChildrenAttribute {
    // eslint-disable-next-line @typescript-eslint/ban-types
    children: {};
  }
}

export type { ZplElement, ZplNode, JSX };
export { jsx, jsx as jsxs, Fragment };
