'use strict'

;(function () {
  /*
   Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
   This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
   The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
   The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
   Code distributed by Google as part of the polymer project is also
   subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
  */

  function c () { this.a = new Map(); this.j = new Map(); this.h = new Map(); this.o = new Set(); this.C = new MutationObserver(this.D.bind(this)); this.f = null; this.F = new Set(); this.enableFlush = !0; this.s = !1; this.m = null } function g () { return h.customElements } function l (a) { if (!/^[a-z][.0-9_a-z]*-[\-.0-9_a-z]*$/.test(a) || t.indexOf(a) !== -1) return Error("The element name '" + a + "' is not valid.") } function m (a, b, e, d) { var c = g(); a = e ? n.call(a, b, e) : n.call(a, b); (b = c.a.get(b.toLowerCase())) && c.u(a, b, d); c.b(a); return a }
  function p (a, b, e, d) { b = b.toLowerCase(); var c = a.getAttribute(b); d.call(a, b, e); a.__$CE_upgraded == 1 && (d = g().a.get(a.localName), e = d.A, (d = d.i) && e.indexOf(b) >= 0 && (e = a.getAttribute(b), e !== c && d.call(a, b, c, e, null))) } var f = document, h = window; if (g() && (g().g = function () {}, !g().forcePolyfill)) return; var t = 'annotation-xml color-profile font-face font-face-src font-face-uri font-face-format font-face-name missing-glyph'.split(' '); c.prototype.L = function (a, b) {
    function e (a) {
      var b = f[a]; if (void 0 !== b && typeof b !== 'function') {
        throw Error(c +
" '" + a + "' is not a Function")
      } return b
    } if (typeof b !== 'function') throw new TypeError('constructor must be a Constructor'); var d = l(a); if (d) throw d; if (this.a.has(a)) throw Error("An element with name '" + a + "' is already defined"); if (this.j.has(b)) throw Error("Definition failed for '" + a + "': The constructor is already used."); var c = a, f = b.prototype; if (typeof f !== 'object') throw new TypeError("Definition failed for '" + a + "': constructor.prototype must be an object"); var d = e('connectedCallback'), g = e('disconnectedCallback'),
      k = e('attributeChangedCallback'); this.a.set(c, {name: a, localName: c, constructor: b, v: d, w: g, i: k, A: k && b.observedAttributes || []}); this.j.set(b, c); this.K(); if (a = this.h.get(c))a.resolve(void 0), this.h.delete(c)
  }; c.prototype.get = function (a) { return (a = this.a.get(a)) ? a.constructor : void 0 }; c.prototype.M = function (a) { var b = l(a); if (b) return Promise.reject(b); if (this.a.has(a)) return Promise.resolve(); if (b = this.h.get(a)) return b.N; var e, d = new Promise(function (a) { e = a }), b = {N: d, resolve: e}; this.h.set(a, b); return d }; c.prototype.g =
function () { this.enableFlush && (this.l(this.m.takeRecords()), this.D(this.C.takeRecords()), this.o.forEach(function (a) { this.l(a.takeRecords()) }, this)) }; c.prototype.K = function () { var a = this; if (!this.s) { this.s = !0; var b = function () { a.s = !1; a.m || (a.m = a.b(f)); a.c(f.childNodes) }; window.HTMLImports ? window.HTMLImports.whenReady(b) : b() } }; c.prototype.I = function (a) { this.f = a }; c.prototype.b = function (a) {
  if (a.__$CE_observer != null) return a.__$CE_observer; a.__$CE_observer = new MutationObserver(this.l.bind(this)); a.__$CE_observer.observe(a,
{childList: !0, subtree: !0}); this.enableFlush && this.o.add(a.__$CE_observer); return a.__$CE_observer
}; c.prototype.J = function (a) { a.__$CE_observer != null && (a.__$CE_observer.disconnect(), this.enableFlush && this.o.delete(a.__$CE_observer), a.__$CE_observer = null) }; c.prototype.l = function (a) { for (var b = 0; b < a.length; b++) { var e = a[b]; if (e.type === 'childList') { var d = e.removedNodes; this.c(e.addedNodes); this.H(d) } } }; c.prototype.c = function (a, b) {
  b = b || new Set(); for (var e = 0; e < a.length; e++) {
    var d = a[e]; if (d.nodeType === Node.ELEMENT_NODE) {
      this.J(d)
      d = f.createTreeWalker(d, NodeFilter.SHOW_ELEMENT, null, !1); do this.G(d.currentNode, b); while (d.nextNode())
    }
  }
}; c.prototype.G = function (a, b) {
  if (!b.has(a)) {
    b.add(a); var e = this.a.get(a.localName); if (e) { a.__$CE_upgraded || this.u(a, e, !0); var d; if (d = a.__$CE_upgraded && !a.__$CE_attached)a: { d = a; do { if (d.__$CE_attached || d.nodeType === Node.DOCUMENT_NODE) { d = !0; break a }d = d.parentNode || d.nodeType === Node.DOCUMENT_FRAGMENT_NODE && d.host } while (d);d = !1 }d && (a.__$CE_attached = !0, e.v && e.v.call(a)) }a.shadowRoot && this.c(a.shadowRoot.childNodes,
b); a.tagName === 'LINK' && a.rel && a.rel.toLowerCase().split(' ').indexOf('import') !== -1 && this.B(a, b)
  }
}; c.prototype.B = function (a, b) { var e = a.import; if (e)b.has(e) || (b.add(e), e.__$CE_observer || this.b(e), this.c(e.childNodes, b)); else if (b = a.href, !this.F.has(b)) { this.F.add(b); var d = this, c = function () { a.removeEventListener('load', c); a.import.__$CE_observer || d.b(a.import); d.c(a.import.childNodes) }; a.addEventListener('load', c) } }; c.prototype.H = function (a) {
  for (var b = 0; b < a.length; b++) {
    var e = a[b]; if (e.nodeType === Node.ELEMENT_NODE) {
      this.b(e)
      e = f.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, null, !1); do { var d = e.currentNode; if (d.__$CE_upgraded && d.__$CE_attached) { d.__$CE_attached = !1; var c = this.a.get(d.localName); c && c.w && c.w.call(d) } } while (e.nextNode())
    }
  }
}; c.prototype.u = function (a, b, e) {
  a.__proto__ = b.constructor.prototype; e && (this.I(a), new b.constructor(), a.__$CE_upgraded = !0, console.assert(!this.f)); e = b.A; if ((b = b.i) && e.length > 0) {
    this.C.observe(a, {attributes: !0, attributeOldValue: !0, attributeFilter: e}); for (var d = 0; d < e.length; d++) {
      var c = e[d]; if (a.hasAttribute(c)) {
        var f =
a.getAttribute(c); b.call(a, c, null, f, null)
      }
    }
  }
}; c.prototype.D = function (a) { for (var b = 0; b < a.length; b++) { var c = a[b]; if (c.type === 'attributes') { var d = c.target, f = this.a.get(d.localName), g = c.attributeName, h = c.oldValue, k = d.getAttribute(g); k !== h && f.i.call(d, g, h, k, c.attributeNamespace) } } }; window.CustomElementRegistry = c; c.prototype.define = c.prototype.L; c.prototype.get = c.prototype.get; c.prototype.whenDefined = c.prototype.M; c.prototype.flush = c.prototype.g; c.prototype.polyfilled = !0; c.prototype._observeRoot = c.prototype.b
  c.prototype._addImport = c.prototype.B; var q = h.HTMLElement; c.prototype.nativeHTMLElement = q; h.HTMLElement = function () { var a = g(); if (a.f) { var b = a.f; a.f = null; return b } if (this.constructor) return a = a.j.get(this.constructor), m(f, a, void 0, !1); throw Error('Unknown constructor. Did you call customElements.define()?') }; h.HTMLElement.prototype = q.prototype; var n = f.createElement; f.createElement = function (a, b) { return m(f, a, b, !0) }; var u = f.createElementNS; f.createElementNS = function (a, b) {
    return a ===
'http://www.w3.org/1999/xhtml' ? f.createElement(b) : u.call(f, a, b)
  }; var r = Element.prototype.attachShadow; r && Object.defineProperty(Element.prototype, 'attachShadow', {value: function (a) { a = r.call(this, a); g().b(a); return a }}); var v = f.importNode; f.importNode = function (a, b) { a = v.call(f, a, b); g().c(a.nodeType === Node.ELEMENT_NODE ? [a] : a.childNodes); return a }; var w = Element.prototype.setAttribute; Element.prototype.setAttribute = function (a, b) { p(this, a, b, w) }; var x = Element.prototype.removeAttribute; Element.prototype.removeAttribute = function (a) {
    p(this,
a, null, x)
  }; Object.defineProperty(window, 'customElements', {value: new c(), configurable: !0, enumerable: !0}); window.CustomElements = {takeRecords: function () { g().g && g().g() }}
})()
