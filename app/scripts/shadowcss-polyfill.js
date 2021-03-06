'use strict'

;(function () {
  /**
  @license
  Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
  This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
  The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
  The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
  Code distributed by Google as part of the polymer project is also
  subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
  */

  /*
  Extremely simple css parser. Intended to be not more than what we need
  and definitely not necessarily correct =).
  */

// given a string of css, return a simple rule tree

  function parse (text) {
    text = clean(text)
    return parseCss(lex(text), text)
  }

// remove stuff we don't care about that may hinder parsing
  function clean (cssText) {
    return cssText.replace(RX.comments, '').replace(RX.port, '')
  }

// super simple {...} lexer that returns a node tree
  function lex (text) {
    var root = {
      start: 0,
      end: text.length
    }
    var n = root
    for (var i = 0, l = text.length; i < l; i++) {
      if (text[i] === OPEN_BRACE) {
        if (!n.rules) {
          n.rules = []
        }
        var p = n
        var previous = p.rules[p.rules.length - 1]
        n = {
          start: i + 1,
          parent: p,
          previous: previous
        }
        p.rules.push(n)
      } else if (text[i] === CLOSE_BRACE) {
        n.end = i + 1
        n = n.parent || root
      }
    }
    return root
  }

// add selectors/cssText to node tree
  function parseCss (node, text) {
    var t = text.substring(node.start, node.end - 1)
    node.parsedCssText = node.cssText = t.trim()
    if (node.parent) {
      var ss = node.previous ? node.previous.end : node.parent.start
      t = text.substring(ss, node.start - 1)
      t = _expandUnicodeEscapes(t)
      t = t.replace(RX.multipleSpaces, ' ')
    // TODO(sorvell): ad hoc; make selector include only after last ;
    // helps with mixin syntax
      t = t.substring(t.lastIndexOf(';') + 1)
      var s = node.parsedSelector = node.selector = t.trim()
      node.atRule = s.indexOf(AT_START) === 0
    // note, support a subset of rule types...
      if (node.atRule) {
        if (s.indexOf(MEDIA_START) === 0) {
          node.type = types.MEDIA_RULE
        } else if (s.match(RX.keyframesRule)) {
          node.type = types.KEYFRAMES_RULE
          node.keyframesName = node.selector.split(RX.multipleSpaces).pop()
        }
      } else {
        if (s.indexOf(VAR_START) === 0) {
          node.type = types.MIXIN_RULE
        } else {
          node.type = types.STYLE_RULE
        }
      }
    }
    var r$ = node.rules
    if (r$) {
      for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
        parseCss(r, text)
      }
    }
    return node
  }

// conversion of sort unicode escapes with spaces like `\33 ` (and longer) into
// expanded form that doesn't require trailing space `\000033`
  function _expandUnicodeEscapes (s) {
    return s.replace(/\\([0-9a-f]{1,6})\s/gi, function () {
      var code = arguments[1],
        repeat = 6 - code.length
      while (repeat--) {
        code = '0' + code
      }
      return '\\' + code
    })
  }

// stringify parsed css.
  function stringify (node, preserveProperties, text) {
    text = text || ''
  // calc rule cssText
    var cssText = ''
    if (node.cssText || node.rules) {
      var r$ = node.rules
      if (r$ && !_hasMixinRules(r$)) {
        for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
          cssText = stringify(r, preserveProperties, cssText)
        }
      } else {
        cssText = preserveProperties ? node.cssText : removeCustomProps(node.cssText)
        cssText = cssText.trim()
        if (cssText) {
          cssText = '  ' + cssText + '\n'
        }
      }
    }
  // emit rule if there is cssText
    if (cssText) {
      if (node.selector) {
        text += node.selector + ' ' + OPEN_BRACE + '\n'
      }
      text += cssText
      if (node.selector) {
        text += CLOSE_BRACE + '\n\n'
      }
    }
    return text
  }

  function _hasMixinRules (rules) {
    return rules[0].selector.indexOf(VAR_START) === 0
  }

  function removeCustomProps (cssText) {
    cssText = removeCustomPropAssignment(cssText)
    return removeCustomPropApply(cssText)
  }

  function removeCustomPropAssignment (cssText) {
    return cssText.replace(RX.customProp, '').replace(RX.mixinProp, '')
  }

  function removeCustomPropApply (cssText) {
    return cssText.replace(RX.mixinApply, '').replace(RX.varApply, '')
  }

  var types = {
    STYLE_RULE: 1,
    KEYFRAMES_RULE: 7,
    MEDIA_RULE: 4,
    MIXIN_RULE: 1000
  }

  var OPEN_BRACE = '{'
  var CLOSE_BRACE = '}'

// helper regexp's
  var RX = {
    comments: /\/\*[^*]*\*+([^/*][^*]*\*+)*\//gim,
    port: /@import[^;]*;/gim,
    customProp: /(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?(?:[;\n]|$)/gim,
    mixinProp: /(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?{[^}]*?}(?:[;\n]|$)?/gim,
    mixinApply: /@apply\s*\(?[^);]*\)?\s*(?:[;\n]|$)?/gim,
    varApply: /[^;:]*?:[^;]*?var\([^;]*\)(?:[;\n]|$)?/gim,
    keyframesRule: /^@[^\s]*keyframes/,
    multipleSpaces: /\s+/g
  }

  var VAR_START = '--'
  var MEDIA_START = '@media'
  var AT_START = '@'

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

  var nativeShadow = !(window.ShadyDOM && window.ShadyDOM.inUse)
// chrome 49 has semi-working css vars, check if box-shadow works
// safari 9.1 has a recalc bug: https://bugs.webkit.org/show_bug.cgi?id=155782
  var nativeCssVariables = !navigator.userAgent.match('AppleWebKit/601') && window.CSS && CSS.supports && CSS.supports('box-shadow', '0 0 0 var(--foo)')

// experimental support for native @apply
  function detectNativeApply () {
    var style = document.createElement('style')
    style.textContent = '.foo { @apply --foo }'
    document.head.appendChild(style)
    var nativeCssApply = style.sheet.cssRules[0].cssText.indexOf('apply') >= 0
    document.head.removeChild(style)
    return nativeCssApply
  }

  var nativeCssApply = false && detectNativeApply()

  function parseSettings (settings) {
    if (settings) {
      nativeCssVariables = nativeCssVariables && !settings.shimcssproperties
      nativeShadow = nativeShadow && !settings.shimshadow
    }
  }

  if (window.ShadyCSS) {
    parseSettings(window.ShadyCSS)
  } else if (window.WebComponents) {
    parseSettings(window.WebComponents.flags)
  }

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

  function toCssText (rules, callback) {
    if (typeof rules === 'string') {
      rules = parse(rules)
    }
    if (callback) {
      forEachRule(rules, callback)
    }
    return stringify(rules, nativeCssVariables)
  }

  function rulesForStyle (style) {
    if (!style.__cssRules && style.textContent) {
      style.__cssRules = parse(style.textContent)
    }
    return style.__cssRules
  }

// Tests if a rule is a keyframes selector, which looks almost exactly
// like a normal selector but is not (it has nothing to do with scoping
// for example).
  function isKeyframesSelector (rule) {
    return rule.parent && rule.parent.type === types.KEYFRAMES_RULE
  }

  function forEachRule (node, styleRuleCallback, keyframesRuleCallback, onlyActiveRules) {
    if (!node) {
      return
    }
    var skipRules = false
    if (onlyActiveRules) {
      if (node.type === types.MEDIA_RULE) {
        var matchMedia = node.selector.match(rx.MEDIA_MATCH)
        if (matchMedia) {
        // if rule is a non matching @media rule, skip subrules
          if (!window.matchMedia(matchMedia[1]).matches) {
            skipRules = true
          }
        }
      }
    }
    if (node.type === types.STYLE_RULE) {
      styleRuleCallback(node)
    } else if (keyframesRuleCallback && node.type === types.KEYFRAMES_RULE) {
      keyframesRuleCallback(node)
    } else if (node.type === types.MIXIN_RULE) {
      skipRules = true
    }
    var r$ = node.rules
    if (r$ && !skipRules) {
      for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
        forEachRule(r, styleRuleCallback, keyframesRuleCallback, onlyActiveRules)
      }
    }
  }

// add a string of cssText to the document.
  function applyCss (cssText, moniker, target, contextNode) {
    var style = createScopeStyle(cssText, moniker)
    return applyStyle$1(style, target, contextNode)
  }

  function applyStyle$1 (style, target, contextNode) {
    target = target || document.head
    var after = contextNode && contextNode.nextSibling || target.firstChild
    lastHeadApplyNode = style
    return target.insertBefore(style, after)
  }

  function createScopeStyle (cssText, moniker) {
    var style = document.createElement('style')
    if (moniker) {
      style.setAttribute('scope', moniker)
    }
    style.textContent = cssText
    return style
  }

  var lastHeadApplyNode = null

// insert a comment node as a styling position placeholder.
  function applyStylePlaceHolder (moniker) {
    var placeHolder = document.createComment(' Shady DOM styles for ' + moniker + ' ')
    var after = lastHeadApplyNode ? lastHeadApplyNode.nextSibling : null
    var scope = document.head
    scope.insertBefore(placeHolder, after || scope.firstChild)
    lastHeadApplyNode = placeHolder
    return placeHolder
  }

// cssBuildTypeForModule: function (module) {
//   let dm = Polymer.DomModule.import(module);
//   if (dm) {
//     return getCssBuildType(dm);
//   }
// },
//

// Walk from text[start] matching parens
// returns position of the outer end paren
  function findMatchingParen (text, start) {
    var level = 0
    for (var i = start, l = text.length; i < l; i++) {
      if (text[i] === '(') {
        level++
      } else if (text[i] === ')') {
        if (--level === 0) {
          return i
        }
      }
    }
    return -1
  }

  function processVariableAndFallback (str, callback) {
  // find 'var('
    var start = str.indexOf('var(')
    if (start === -1) {
    // no var?, everything is prefix
      return callback(str, '', '', '')
    }
  // ${prefix}var(${inner})${suffix}
    var end = findMatchingParen(str, start + 3)
    var inner = str.substring(start + 4, end)
    var prefix = str.substring(0, start)
  // suffix may have other variables
    var suffix = processVariableAndFallback(str.substring(end + 1), callback)
    var comma = inner.indexOf(',')
  // value and fallback args should be trimmed to match in property lookup
    if (comma === -1) {
    // variable, no fallback
      return callback(prefix, inner.trim(), '', suffix)
    }
  // var(${value},${fallback})
    var value = inner.substring(0, comma).trim()
    var fallback = inner.substring(comma + 1).trim()
    return callback(prefix, value, fallback, suffix)
  }

  function setElementClassRaw (element, value) {
  // use native setAttribute provided by ShadyDOM when setAttribute is patched
    if (element.__nativeSetAttribute) {
      element.__nativeSetAttribute('class', value)
    } else {
      element.setAttribute('class', value)
    }
  }

  var rx = {
    VAR_ASSIGN: /(?:^|[;\s{]\s*)(--[\w-]*?)\s*:\s*(?:([^;{]*)|{([^}]*)})(?:(?=[;\s}])|$)/gi,
    MIXIN_MATCH: /(?:^|\W+)@apply\s*\(?([^);\n]*)\)?/gi,
    VAR_CONSUMED: /(--[\w-]+)\s*([:,;)]|$)/gi,
    ANIMATION_MATCH: /(animation\s*:)|(animation-name\s*:)/,
    MEDIA_MATCH: /@media[^(]*(\([^)]*\))/,
    IS_VAR: /^--/,
    BRACKETED: /\{[^}]*\}/g,
    HOST_PREFIX: '(?:^|[^.#[:])',
    HOST_SUFFIX: '($|[.:[\\s>+~])'
  }

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

/* Transforms ShadowDOM styling into ShadyDOM styling

* scoping:

  * elements in scope get scoping selector class="x-foo-scope"
  * selectors re-written as follows:

    div button -> div.x-foo-scope button.x-foo-scope

* :host -> scopeName

* :host(...) -> scopeName...

* ::slotted(...) -> scopeName > ...

* ...:dir(ltr|rtl) -> [dir="ltr|rtl"] ..., ...[dir="ltr|rtl"]

* :host(:dir[rtl]) -> scopeName:dir(rtl) -> [dir="rtl"] scopeName, scopeName[dir="rtl"]

*/
  var SCOPE_NAME = 'style-scope'

  var StyleTransformer = {

  // Given a node and scope name, add a scoping class to each node
  // in the tree. This facilitates transforming css into scoped rules.
    dom: function dom (node, scope, shouldRemoveScope) {
    // one time optimization to skip scoping...
      if (node.__styleScoped) {
        node.__styleScoped = null
      } else {
        this._transformDom(node, scope || '', shouldRemoveScope)
      }
    },

    _transformDom: function _transformDom (node, selector, shouldRemoveScope) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        this.element(node, selector, shouldRemoveScope)
      }
      var c$ = node.localName === 'template' ? (node.content || node._content).childNodes : node.children || node.childNodes
      if (c$) {
        for (var i = 0; i < c$.length; i++) {
          this._transformDom(c$[i], selector, shouldRemoveScope)
        }
      }
    },

    element: function element (_element, scope, shouldRemoveScope) {
    // note: if using classes, we add both the general 'style-scope' class
    // as well as the specific scope. This enables easy filtering of all
    // `style-scope` elements
      if (scope) {
      // note: svg on IE does not have classList so fallback to class
        if (_element.classList) {
          if (shouldRemoveScope) {
            _element.classList.remove(SCOPE_NAME)
            _element.classList.remove(scope)
          } else {
            _element.classList.add(SCOPE_NAME)
            _element.classList.add(scope)
          }
        } else if (_element.getAttribute) {
          var c = _element.getAttribute(CLASS)
          if (shouldRemoveScope) {
            if (c) {
              var newValue = c.replace(SCOPE_NAME, '').replace(scope, '')
              setElementClassRaw(_element, newValue)
            }
          } else {
            var _newValue = (c ? c + ' ' : '') + SCOPE_NAME + ' ' + scope
            setElementClassRaw(_element, _newValue)
          }
        }
      }
    },

    elementStyles: function elementStyles (element, styleRules, callback) {
      var cssBuildType = element.__cssBuild
    // no need to shim selectors if settings.useNativeShadow, also
    // a shady css build will already have transformed selectors
    // NOTE: This method may be called as part of static or property shimming.
    // When there is a targeted build it will not be called for static shimming,
    // but when the property shim is used it is called and should opt out of
    // static shimming work when a proper build exists.
      var cssText = nativeShadow || cssBuildType === 'shady' ? toCssText(styleRules, callback) : this.css(styleRules, element.is, element.extends, callback) + '\n\n'
      return cssText.trim()
    },

  // Given a string of cssText and a scoping string (scope), returns
  // a string of scoped css where each selector is transformed to include
  // a class created from the scope. ShadowDOM selectors are also transformed
  // (e.g. :host) to use the scoping selector.
    css: function css (rules, scope, ext, callback) {
      var hostScope = this._calcHostScope(scope, ext)
      scope = this._calcElementScope(scope)
      var self = this
      return toCssText(rules, function (rule) {
        if (!rule.isScoped) {
          self.rule(rule, scope, hostScope)
          rule.isScoped = true
        }
        if (callback) {
          callback(rule, scope, hostScope)
        }
      })
    },

    _calcElementScope: function _calcElementScope (scope) {
      if (scope) {
        return CSS_CLASS_PREFIX + scope
      } else {
        return ''
      }
    },

    _calcHostScope: function _calcHostScope (scope, ext) {
      return ext ? '[is=' + scope + ']' : scope
    },

    rule: function rule (_rule, scope, hostScope) {
      this._transformRule(_rule, this._transformComplexSelector, scope, hostScope)
    },

  // transforms a css rule to a scoped rule.
    _transformRule: function _transformRule (rule, transformer, scope, hostScope) {
    // NOTE: save transformedSelector for subsequent matching of elements
    // against selectors (e.g. when calculating style properties)
      rule.selector = rule.transformedSelector = this._transformRuleCss(rule, transformer, scope, hostScope)
    },

    _transformRuleCss: function _transformRuleCss (rule, transformer, scope, hostScope) {
      var p$ = rule.selector.split(COMPLEX_SELECTOR_SEP)
    // we want to skip transformation of rules that appear in keyframes,
    // because they are keyframe selectors, not element selectors.
      if (!isKeyframesSelector(rule)) {
        for (var i = 0, l = p$.length, p; i < l && (p = p$[i]); i++) {
          p$[i] = transformer.call(this, p, scope, hostScope)
        }
      }
      return p$.join(COMPLEX_SELECTOR_SEP)
    },

    _transformComplexSelector: function _transformComplexSelector (selector, scope, hostScope) {
      var _this = this

      var stop = false
      selector = selector.trim()
    // Remove spaces inside of selectors like `:nth-of-type` because it confuses SIMPLE_SELECTOR_SEP
      selector = selector.replace(NTH, function (m, type, inner) {
        return ':' + type + '(' + inner.replace(/\s/g, '') + ')'
      })
      selector = selector.replace(SLOTTED_START, HOST + ' $1')
      selector = selector.replace(SIMPLE_SELECTOR_SEP, function (m, c, s) {
        if (!stop) {
          var info = _this._transformCompoundSelector(s, c, scope, hostScope)
          stop = stop || info.stop
          c = info.combinator
          s = info.value
        }
        return c + s
      })
      return selector
    },

    _transformCompoundSelector: function _transformCompoundSelector (selector, combinator, scope, hostScope) {
    // replace :host with host scoping class
      var slottedIndex = selector.indexOf(SLOTTED)
      if (selector.indexOf(HOST) >= 0) {
        selector = this._transformHostSelector(selector, hostScope)
      // replace other selectors with scoping class
      } else if (slottedIndex !== 0) {
        selector = scope ? this._transformSimpleSelector(selector, scope) : selector
      }
    // mark ::slotted() scope jump to replace with descendant selector + arg
    // also ignore left-side combinator
      var slotted = false
      if (slottedIndex >= 0) {
        combinator = ''
        slotted = true
      }
    // process scope jumping selectors up to the scope jump and then stop
      var stop = void 0
      if (slotted) {
        stop = true
        if (slotted) {
        // .zonk ::slotted(.foo) -> .zonk.scope > .foo
          selector = selector.replace(SLOTTED_PAREN, function (m, paren) {
            return ' > ' + paren
          })
        }
      }
      selector = selector.replace(DIR_PAREN, function (m, before, dir) {
        return '[dir="' + dir + '"] ' + before + ', ' + before + '[dir="' + dir + '"]'
      })
      return { value: selector, combinator: combinator, stop: stop }
    },

    _transformSimpleSelector: function _transformSimpleSelector (selector, scope) {
      var p$ = selector.split(PSEUDO_PREFIX)
      p$[0] += scope
      return p$.join(PSEUDO_PREFIX)
    },

  // :host(...) -> scopeName...
    _transformHostSelector: function _transformHostSelector (selector, hostScope) {
      var m = selector.match(HOST_PAREN)
      var paren = m && m[2].trim() || ''
      if (paren) {
        if (!paren[0].match(SIMPLE_SELECTOR_PREFIX)) {
        // paren starts with a type selector
          var typeSelector = paren.split(SIMPLE_SELECTOR_PREFIX)[0]
        // if the type selector is our hostScope then avoid pre-pending it
          if (typeSelector === hostScope) {
            return paren
          // otherwise, this selector should not match in this scope so
          // output a bogus selector.
          } else {
            return SELECTOR_NO_MATCH
          }
        } else {
        // make sure to do a replace here to catch selectors like:
        // `:host(.foo)::before`
          return selector.replace(HOST_PAREN, function (m, host, paren) {
            return hostScope + paren
          })
        }
      // if no paren, do a straight :host replacement.
      // TODO(sorvell): this should not strictly be necessary but
      // it's needed to maintain support for `:host[foo]` type selectors
      // which have been improperly used under Shady DOM. This should be
      // deprecated.
      } else {
        return selector.replace(HOST, hostScope)
      }
    },

    documentRule: function documentRule (rule) {
    // reset selector in case this is redone.
      rule.selector = rule.parsedSelector
      this.normalizeRootSelector(rule)
      this._transformRule(rule, this._transformDocumentSelector)
    },

    normalizeRootSelector: function normalizeRootSelector (rule) {
      if (rule.selector === ROOT) {
        rule.selector = 'html'
      }
    },

    _transformDocumentSelector: function _transformDocumentSelector (selector) {
      return selector.match(SLOTTED) ? this._transformComplexSelector(selector, SCOPE_DOC_SELECTOR) : this._transformSimpleSelector(selector.trim(), SCOPE_DOC_SELECTOR)
    },
    SCOPE_NAME: SCOPE_NAME
  }

  var NTH = /:(nth[-\w]+)\(([^)]+)\)/
  var SCOPE_DOC_SELECTOR = ':not(.' + SCOPE_NAME + ')'
  var COMPLEX_SELECTOR_SEP = ','
  var SIMPLE_SELECTOR_SEP = /(^|[\s>+~]+)((?:\[.+?\]|[^\s>+~=\[])+)/g
  var SIMPLE_SELECTOR_PREFIX = /[[.:#*]/
  var HOST = ':host'
  var ROOT = ':root'
  var SLOTTED = '::slotted'
  var SLOTTED_START = new RegExp('^(' + SLOTTED + ')')
// NOTE: this supports 1 nested () pair for things like
// :host(:not([selected]), more general support requires
// parsing which seems like overkill
  var HOST_PAREN = /(:host)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))/
// similar to HOST_PAREN
  var SLOTTED_PAREN = /(?:::slotted)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))/
  var DIR_PAREN = /(.*):dir\((?:(ltr|rtl))\)/
  var CSS_CLASS_PREFIX = '.'
  var PSEUDO_PREFIX = ':'
  var CLASS = 'class'
  var SELECTOR_NO_MATCH = 'should_not_match'

  var asyncGenerator = (function () {
    function AwaitValue (value) {
      this.value = value
    }

    function AsyncGenerator (gen) {
      var front, back

      function send (key, arg) {
        return new Promise(function (resolve, reject) {
          var request = {
            key: key,
            arg: arg,
            resolve: resolve,
            reject: reject,
            next: null
          }

          if (back) {
            back = back.next = request
          } else {
            front = back = request
            resume(key, arg)
          }
        })
      }

      function resume (key, arg) {
        try {
          var result = gen[key](arg)
          var value = result.value

          if (value instanceof AwaitValue) {
            Promise.resolve(value.value).then(function (arg) {
              resume('next', arg)
            }, function (arg) {
              resume('throw', arg)
            })
          } else {
            settle(result.done ? 'return' : 'normal', result.value)
          }
        } catch (err) {
          settle('throw', err)
        }
      }

      function settle (type, value) {
        switch (type) {
          case 'return':
            front.resolve({
              value: value,
              done: true
            })
            break

          case 'throw':
            front.reject(value)
            break

          default:
            front.resolve({
              value: value,
              done: false
            })
            break
        }

        front = front.next

        if (front) {
          resume(front.key, front.arg)
        } else {
          back = null
        }
      }

      this._invoke = send

      if (typeof gen.return !== 'function') {
        this.return = undefined
      }
    }

    if (typeof Symbol === 'function' && Symbol.asyncIterator) {
      AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
        return this
      }
    }

    AsyncGenerator.prototype.next = function (arg) {
      return this._invoke('next', arg)
    }

    AsyncGenerator.prototype.throw = function (arg) {
      return this._invoke('throw', arg)
    }

    AsyncGenerator.prototype.return = function (arg) {
      return this._invoke('return', arg)
    }

    return {
      wrap: function (fn) {
        return function () {
          return new AsyncGenerator(fn.apply(this, arguments))
        }
      },
      await: function (value) {
        return new AwaitValue(value)
      }
    }
  }())

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError('Cannot call a class as a function')
    }
  }

  var createClass = (function () {
    function defineProperties (target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i]
        descriptor.enumerable = descriptor.enumerable || false
        descriptor.configurable = true
        if ('value' in descriptor) descriptor.writable = true
        Object.defineProperty(target, descriptor.key, descriptor)
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps)
      if (staticProps) defineProperties(Constructor, staticProps)
      return Constructor
    }
  }())

  var get$1 = function get$1 (object, property, receiver) {
    if (object === null) object = Function.prototype
    var desc = Object.getOwnPropertyDescriptor(object, property)

    if (desc === undefined) {
      var parent = Object.getPrototypeOf(object)

      if (parent === null) {
        return undefined
      } else {
        return get$1(parent, property, receiver)
      }
    } else if ('value' in desc) {
      return desc.value
    } else {
      var getter = desc.get

      if (getter === undefined) {
        return undefined
      }

      return getter.call(receiver)
    }
  }

  var set$1 = function set$1 (object, property, value, receiver) {
    var desc = Object.getOwnPropertyDescriptor(object, property)

    if (desc === undefined) {
      var parent = Object.getPrototypeOf(object)

      if (parent !== null) {
        set$1(parent, property, value, receiver)
      }
    } else if ('value' in desc && desc.writable) {
      desc.value = value
    } else {
      var setter = desc.set

      if (setter !== undefined) {
        setter.call(receiver, value)
      }
    }

    return value
  }

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

  var StyleInfo = (function () {
    createClass(StyleInfo, null, [{
      key: 'get',
      value: function get (node) {
        return node.__styleInfo
      }
    }, {
      key: 'set',
      value: function set (node, styleInfo) {
        node.__styleInfo = styleInfo
        return styleInfo
      }
    }])

    function StyleInfo (ast, placeholder, ownStylePropertyNames, elementName, typeExtension, cssBuild) {
      classCallCheck(this, StyleInfo)

      this.styleRules = ast || null
      this.placeholder = placeholder || null
      this.ownStylePropertyNames = ownStylePropertyNames || []
      this.overrideStyleProperties = null
      this.elementName = elementName || ''
      this.cssBuild = cssBuild || ''
      this.typeExtension = typeExtension || ''
      this.styleProperties = null
      this.scopeSelector = null
      this.customStyle = null
    }

    return StyleInfo
  }())

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

// TODO: dedupe with shady
  var p = window.Element.prototype
  var matchesSelector = p.matches || p.matchesSelector || p.mozMatchesSelector || p.msMatchesSelector || p.oMatchesSelector || p.webkitMatchesSelector

  var IS_IE = navigator.userAgent.match('Trident')

  var StyleProperties = {

  // decorates styles with rule info and returns an array of used style
  // property names
    decorateStyles: function decorateStyles (rules) {
      var self = this,
        props = {},
        keyframes = [],
        ruleIndex = 0
      forEachRule(rules, function (rule) {
        self.decorateRule(rule)
      // mark in-order position of ast rule in styles block, used for cache key
        rule.index = ruleIndex++
        self.collectPropertiesInCssText(rule.propertyInfo.cssText, props)
      }, function onKeyframesRule (rule) {
        keyframes.push(rule)
      })
    // Cache all found keyframes rules for later reference:
      rules._keyframes = keyframes
    // return this list of property names *consumes* in these styles.
      var names = []
      for (var i in props) {
        names.push(i)
      }
      return names
    },

  // decorate a single rule with property info
    decorateRule: function decorateRule (rule) {
      if (rule.propertyInfo) {
        return rule.propertyInfo
      }
      var info = {},
        properties = {}
      var hasProperties = this.collectProperties(rule, properties)
      if (hasProperties) {
        info.properties = properties
      // TODO(sorvell): workaround parser seeing mixins as additional rules
        rule.rules = null
      }
      info.cssText = this.collectCssText(rule)
      rule.propertyInfo = info
      return info
    },

  // collects the custom properties from a rule's cssText
    collectProperties: function collectProperties (rule, properties) {
      var info = rule.propertyInfo
      if (info) {
        if (info.properties) {
          Object.assign(properties, info.properties)
          return true
        }
      } else {
        var m = void 0,
          rx$$1 = this.rx.VAR_ASSIGN
        var cssText = rule.parsedCssText
        var value = void 0
        var any = void 0
        while (m = rx$$1.exec(cssText)) {
        // note: group 2 is var, 3 is mixin
          value = (m[2] || m[3]).trim()
        // value of 'inherit' or 'unset' is equivalent to not setting the property here
          if (value !== 'inherit' || value !== 'unset') {
            properties[m[1].trim()] = value
          }
          any = true
        }
        return any
      }
    },

  // returns cssText of properties that consume variables/mixins
    collectCssText: function collectCssText (rule) {
      return this.collectConsumingCssText(rule.parsedCssText)
    },

  // NOTE: we support consumption inside mixin assignment
  // but not production, so strip out {...}
    collectConsumingCssText: function collectConsumingCssText (cssText) {
      return cssText.replace(this.rx.BRACKETED, '').replace(this.rx.VAR_ASSIGN, '')
    },

    collectPropertiesInCssText: function collectPropertiesInCssText (cssText, props) {
      var m = void 0
      while (m = this.rx.VAR_CONSUMED.exec(cssText)) {
        var name = m[1]
      // This regex catches all variable names, and following non-whitespace char
      // If next char is not ':', then variable is a consumer
        if (m[2] !== ':') {
          props[name] = true
        }
      }
    },

  // turns custom properties into realized values.
    reify: function reify (props) {
    // big perf optimization here: reify only *own* properties
    // since this object has __proto__ of the element's scope properties
      var names = Object.getOwnPropertyNames(props)
      for (var i = 0, n; i < names.length; i++) {
        n = names[i]
        props[n] = this.valueForProperty(props[n], props)
      }
    },

  // given a property value, returns the reified value
  // a property value may be:
  // (1) a literal value like: red or 5px;
  // (2) a variable value like: var(--a), var(--a, red), or var(--a, --b) or
  // var(--a, var(--b));
  // (3) a literal mixin value like { properties }. Each of these properties
  // can have values that are: (a) literal, (b) variables, (c) @apply mixins.
    valueForProperty: function valueForProperty (property, props) {
      var _this = this

    // case (1) default
    // case (3) defines a mixin and we have to reify the internals
      if (property) {
        if (property.indexOf(';') >= 0) {
          property = this.valueForProperties(property, props)
        } else {
          (function () {
          // case (2) variable
            var self = _this
            var fn = function fn (prefix, value, fallback, suffix) {
              if (!value) {
                return prefix + suffix
              }
              var propertyValue = self.valueForProperty(props[value], props)
            // if value is "initial", then the variable should be treated as unset
              if (!propertyValue || propertyValue === 'initial') {
              // fallback may be --a or var(--a) or literal
                propertyValue = self.valueForProperty(props[fallback] || fallback, props) || fallback
              } else if (propertyValue === 'apply-shim-inherit') {
              // CSS build will replace `inherit` with `apply-shim-inherit`
              // for use with native css variables.
              // Since we have full control, we can use `inherit` directly.
                propertyValue = 'inherit'
              }
              return prefix + (propertyValue || '') + suffix
            }
            property = processVariableAndFallback(property, fn)
          })()
        }
      }
      return property && property.trim() || ''
    },

  // note: we do not yet support mixin within mixin
    valueForProperties: function valueForProperties (property, props) {
      var parts = property.split(';')
      for (var i = 0, _p, m; i < parts.length; i++) {
        if (_p = parts[i]) {
          this.rx.MIXIN_MATCH.lastIndex = 0
          m = this.rx.MIXIN_MATCH.exec(_p)
          if (m) {
            _p = this.valueForProperty(props[m[1]], props)
          } else {
            var colon = _p.indexOf(':')
            if (colon !== -1) {
              var pp = _p.substring(colon)
              pp = pp.trim()
              pp = this.valueForProperty(pp, props) || pp
              _p = _p.substring(0, colon) + pp
            }
          }
          parts[i] = _p && _p.lastIndexOf(';') === _p.length - 1 ?
        // strip trailing ;
        _p.slice(0, -1) : _p || ''
        }
      }
      return parts.join(';')
    },

    applyProperties: function applyProperties (rule, props) {
      var output = ''
    // dynamically added sheets may not be decorated so ensure they are.
      if (!rule.propertyInfo) {
        this.decorateRule(rule)
      }
      if (rule.propertyInfo.cssText) {
        output = this.valueForProperties(rule.propertyInfo.cssText, props)
      }
      rule.cssText = output
    },

  // Apply keyframe transformations to the cssText of a given rule. The
  // keyframeTransforms object is a map of keyframe names to transformer
  // functions which take in cssText and spit out transformed cssText.
    applyKeyframeTransforms: function applyKeyframeTransforms (rule, keyframeTransforms) {
      var input = rule.cssText
      var output = rule.cssText
      if (rule.hasAnimations == null) {
      // Cache whether or not the rule has any animations to begin with:
        rule.hasAnimations = this.rx.ANIMATION_MATCH.test(input)
      }
    // If there are no animations referenced, we can skip transforms:
      if (rule.hasAnimations) {
        var transform = void 0
      // If we haven't transformed this rule before, we iterate over all
      // transforms:
        if (rule.keyframeNamesToTransform == null) {
          rule.keyframeNamesToTransform = []
          for (var keyframe in keyframeTransforms) {
            transform = keyframeTransforms[keyframe]
            output = transform(input)
          // If the transform actually changed the CSS text, we cache the
          // transform name for future use:
            if (input !== output) {
              input = output
              rule.keyframeNamesToTransform.push(keyframe)
            }
          }
        } else {
        // If we already have a list of keyframe names that apply to this
        // rule, we apply only those keyframe name transforms:
          for (var i = 0; i < rule.keyframeNamesToTransform.length; ++i) {
            transform = keyframeTransforms[rule.keyframeNamesToTransform[i]]
            input = transform(input)
          }
          output = input
        }
      }
      rule.cssText = output
    },

  // Test if the rules in these styles matches the given `element` and if so,
  // collect any custom properties into `props`.
    propertyDataFromStyles: function propertyDataFromStyles (rules, element) {
      var props = {},
        self = this
    // generates a unique key for these matches
      var o = []
    // note: active rules excludes non-matching @media rules
      forEachRule(rules, function (rule) {
      // TODO(sorvell): we could trim the set of rules at declaration
      // time to only include ones that have properties
        if (!rule.propertyInfo) {
          self.decorateRule(rule)
        }
      // match element against transformedSelector: selector may contain
      // unwanted uniquification and parsedSelector does not directly match
      // for :host selectors.
        var selectorToMatch = rule.transformedSelector || rule.parsedSelector
        if (element && rule.propertyInfo.properties && selectorToMatch) {
          if (matchesSelector.call(element, selectorToMatch)) {
            self.collectProperties(rule, props)
          // produce numeric key for these matches for lookup
            addToBitMask(rule.index, o)
          }
        }
      }, null, true)
      return { properties: props, key: o }
    },

    whenHostOrRootRule: function whenHostOrRootRule (scope, rule, cssBuild, callback) {
      if (!rule.propertyInfo) {
        this.decorateRule(rule)
      }
      if (!rule.propertyInfo.properties) {
        return
      }
      var hostScope = scope.is ? StyleTransformer._calcHostScope(scope.is, scope.extends) : 'html'
      var parsedSelector = rule.parsedSelector
      var isRoot = parsedSelector === ':host > *' || parsedSelector === 'html'
      var isHost = parsedSelector.indexOf(':host') === 0 && !isRoot
    // build info is either in scope (when scope is an element) or in the style
    // when scope is the default scope; note: this allows default scope to have
    // mixed mode built and unbuilt styles.
      if (cssBuild === 'shady') {
      // :root -> x-foo > *.x-foo for elements and html for custom-style
        isRoot = parsedSelector === hostScope + ' > *.' + hostScope || parsedSelector.indexOf('html') !== -1
      // :host -> x-foo for elements, but sub-rules have .x-foo in them
        isHost = !isRoot && parsedSelector.indexOf(hostScope) === 0
      }
      if (cssBuild === 'shadow') {
        isRoot = parsedSelector === ':host > *' || parsedSelector === 'html'
        isHost = isHost && !isRoot
      }
      if (!isRoot && !isHost) {
        return
      }
      var selectorToMatch = hostScope
      if (isHost) {
      // need to transform :host under ShadowDOM because `:host` does not work with `matches`
        if (nativeShadow && !rule.transformedSelector) {
        // transform :host into a matchable selector
          rule.transformedSelector = StyleTransformer._transformRuleCss(rule, StyleTransformer._transformComplexSelector, StyleTransformer._calcElementScope(scope.is), hostScope)
        }
        selectorToMatch = rule.transformedSelector || hostScope
      }
      callback({
        selector: selectorToMatch,
        isHost: isHost,
        isRoot: isRoot
      })
    },

    hostAndRootPropertiesForScope: function hostAndRootPropertiesForScope (scope, rules) {
      var hostProps = {},
        rootProps = {},
        self = this
    // note: active rules excludes non-matching @media rules
      var cssBuild = rules && rules.__cssBuild
      forEachRule(rules, function (rule) {
      // if scope is StyleDefaults, use _element for matchesSelector
        self.whenHostOrRootRule(scope, rule, cssBuild, function (info) {
          var element = scope._element || scope
          if (matchesSelector.call(element, info.selector)) {
            if (info.isHost) {
              self.collectProperties(rule, hostProps)
            } else {
              self.collectProperties(rule, rootProps)
            }
          }
        })
      }, null, true)
      return { rootProps: rootProps, hostProps: hostProps }
    },

    transformStyles: function transformStyles (element, properties, scopeSelector) {
      var self = this
      var hostSelector = StyleTransformer._calcHostScope(element.is, element.extends)
      var rxHostSelector = element.extends ? '\\' + hostSelector.slice(0, -1) + '\\]' : hostSelector
      var hostRx = new RegExp(this.rx.HOST_PREFIX + rxHostSelector + this.rx.HOST_SUFFIX)
      var rules = StyleInfo.get(element).styleRules
      var keyframeTransforms = this._elementKeyframeTransforms(element, rules, scopeSelector)
      return StyleTransformer.elementStyles(element, rules, function (rule) {
        self.applyProperties(rule, properties)
        if (!nativeShadow && !isKeyframesSelector(rule) && rule.cssText) {
        // NOTE: keyframe transforms only scope munge animation names, so it
        // is not necessary to apply them in ShadowDOM.
          self.applyKeyframeTransforms(rule, keyframeTransforms)
          self._scopeSelector(rule, hostRx, hostSelector, scopeSelector)
        }
      })
    },

    _elementKeyframeTransforms: function _elementKeyframeTransforms (element, rules, scopeSelector) {
      var keyframesRules = rules._keyframes
      var keyframeTransforms = {}
      if (!nativeShadow && keyframesRules) {
      // For non-ShadowDOM, we transform all known keyframes rules in
      // advance for the current scope. This allows us to catch keyframes
      // rules that appear anywhere in the stylesheet:
        for (var i = 0, keyframesRule = keyframesRules[i]; i < keyframesRules.length; keyframesRule = keyframesRules[++i]) {
          this._scopeKeyframes(keyframesRule, scopeSelector)
          keyframeTransforms[keyframesRule.keyframesName] = this._keyframesRuleTransformer(keyframesRule)
        }
      }
      return keyframeTransforms
    },

  // Generate a factory for transforming a chunk of CSS text to handle a
  // particular scoped keyframes rule.
    _keyframesRuleTransformer: function _keyframesRuleTransformer (keyframesRule) {
      return function (cssText) {
        return cssText.replace(keyframesRule.keyframesNameRx, keyframesRule.transformedKeyframesName)
      }
    },

  // Transforms `@keyframes` names to be unique for the current host.
  // Example: @keyframes foo-anim -> @keyframes foo-anim-x-foo-0
    _scopeKeyframes: function _scopeKeyframes (rule, scopeId) {
      rule.keyframesNameRx = new RegExp(rule.keyframesName, 'g')
      rule.transformedKeyframesName = rule.keyframesName + '-' + scopeId
      rule.transformedSelector = rule.transformedSelector || rule.selector
      rule.selector = rule.transformedSelector.replace(rule.keyframesName, rule.transformedKeyframesName)
    },

  // Strategy: x scope shim a selector e.g. to scope `.x-foo-42` (via classes):
  // non-host selector: .a.x-foo -> .x-foo-42 .a.x-foo
  // host selector: x-foo.wide -> .x-foo-42.wide
  // note: we use only the scope class (.x-foo-42) and not the hostSelector
  // (x-foo) to scope :host rules; this helps make property host rules
  // have low specificity. They are overrideable by class selectors but,
  // unfortunately, not by type selectors (e.g. overriding via
  // `.special` is ok, but not by `x-foo`).
    _scopeSelector: function _scopeSelector (rule, hostRx, hostSelector, scopeId) {
      rule.transformedSelector = rule.transformedSelector || rule.selector
      var selector = rule.transformedSelector
      var scope = '.' + scopeId
      var parts = selector.split(',')
      for (var i = 0, l = parts.length, _p2; i < l && (_p2 = parts[i]); i++) {
        parts[i] = _p2.match(hostRx) ? _p2.replace(hostSelector, scope) : scope + ' ' + _p2
      }
      rule.selector = parts.join(',')
    },

    applyElementScopeSelector: function applyElementScopeSelector (element, selector, old) {
      var c = element.getAttribute('class') || ''
      var v = c
      if (old) {
        v = c.replace(new RegExp('\\s*' + this.XSCOPE_NAME + '\\s*' + old + '\\s*', 'g'), ' ')
      }
      v += (v ? ' ' : '') + this.XSCOPE_NAME + ' ' + selector
      if (c !== v) {
      // hook from ShadyDOM
        if (element.__nativeSetAttribute) {
          element.__nativeSetAttribute('class', v)
        } else {
          element.setAttribute('class', v)
        }
      }
    },

    applyElementStyle: function applyElementStyle (element, properties, selector, style) {
    // calculate cssText to apply
      var cssText = style ? style.textContent || '' : this.transformStyles(element, properties, selector)
    // if shady and we have a cached style that is not style, decrement
      var styleInfo = StyleInfo.get(element)
      var s = styleInfo.customStyle
      if (s && !nativeShadow && s !== style) {
        s._useCount--
        if (s._useCount <= 0 && s.parentNode) {
          s.parentNode.removeChild(s)
        }
      }
    // apply styling always under native or if we generated style
    // or the cached style is not in document(!)
      if (nativeShadow) {
      // update existing style only under native
        if (styleInfo.customStyle) {
          styleInfo.customStyle.textContent = cssText
          style = styleInfo.customStyle
        // otherwise, if we have css to apply, do so
        } else if (cssText) {
        // apply css after the scope style of the element to help with
        // style precedence rules.
          style = applyCss(cssText, selector, element.shadowRoot, styleInfo.placeholder)
        }
      } else {
      // shady and no cache hit
        if (!style) {
        // apply css after the scope style of the element to help with
        // style precedence rules.
          if (cssText) {
            style = applyCss(cssText, selector, null, styleInfo.placeholder)
          }
        // shady and cache hit but not in document
        } else if (!style.parentNode) {
          applyStyle$1(style, null, styleInfo.placeholder)
        }
      }
    // ensure this style is our custom style and increment its use count.
      if (style) {
        style._useCount = style._useCount || 0
      // increment use count if we changed styles
        if (styleInfo.customStyle != style) {
          style._useCount++
        }
        styleInfo.customStyle = style
      }
    // @media rules may be stale in IE 10 and 11
      if (IS_IE) {
        style.textContent = style.textContent
      }
      return style
    },

    applyCustomStyle: function applyCustomStyle (style, properties) {
      var rules = rulesForStyle(style)
      var self = this
      style.textContent = toCssText(rules, function (rule) {
        var css = rule.cssText = rule.parsedCssText
        if (rule.propertyInfo && rule.propertyInfo.cssText) {
        // remove property assignments
        // so next function isn't confused
        // NOTE: we have 3 categories of css:
        // (1) normal properties,
        // (2) custom property assignments (--foo: red;),
        // (3) custom property usage: border: var(--foo); @apply(--foo);
        // In elements, 1 and 3 are separated for efficiency; here they
        // are not and this makes this case unique.
          css = removeCustomPropAssignment(css)
        // replace with reified properties, scenario is same as mixin
          rule.cssText = self.valueForProperties(css, properties)
        }
      })
    },

    rx: rx,
    XSCOPE_NAME: 'x-scope'
  }

  function addToBitMask (n, bits) {
    var o = parseInt(n / 32)
    var v = 1 << n % 32
    bits[o] = (bits[o] || 0) | v
  }

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

  var templateMap = {}

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

  var placeholderMap = {}

  var ce = window.customElements
  if (ce && !nativeShadow) {
    (function () {
      var origDefine = ce.define
      ce.define = function (name, clazz, options) {
        placeholderMap[name] = applyStylePlaceHolder(name)
        return origDefine.call(ce, name, clazz, options)
      }
    })()
  }

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
  var StyleCache = (function () {
    function StyleCache () {
      var typeMax = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 100
      classCallCheck(this, StyleCache)

    // map element name -> [{properties, styleElement, scopeSelector}]
      this.cache = {}
      this.typeMax = typeMax
    }

    createClass(StyleCache, [{
      key: '_validate',
      value: function _validate (cacheEntry, properties, ownPropertyNames) {
        for (var idx = 0; idx < ownPropertyNames.length; idx++) {
          var pn = ownPropertyNames[idx]
          if (cacheEntry.properties[pn] !== properties[pn]) {
            return false
          }
        }
        return true
      }
    }, {
      key: 'store',
      value: function store (tagname, properties, styleElement, scopeSelector) {
        var list = this.cache[tagname] || []
        list.push({ properties: properties, styleElement: styleElement, scopeSelector: scopeSelector })
        if (list.length > this.typeMax) {
          list.shift()
        }
        this.cache[tagname] = list
      }
    }, {
      key: 'fetch',
      value: function fetch (tagname, properties, ownPropertyNames) {
        var list = this.cache[tagname]
        if (!list) {
          return
        }
      // reverse list for most-recent lookups
        for (var idx = list.length - 1; idx >= 0; idx--) {
          var entry = list[idx]
          if (this._validate(entry, properties, ownPropertyNames)) {
            return entry
          }
        }
      }
    }])
    return StyleCache
  }())

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
/**
 * The apply shim simulates the behavior of `@apply` proposed at
 * https://tabatkins.github.io/specs/css-apply-rule/.
 * The approach is to convert a property like this:
 *
 *    --foo: {color: red; background: blue;}
 *
 * to this:
 *
 *    --foo_-_color: red;
 *    --foo_-_background: blue;
 *
 * Then where `@apply --foo` is used, that is converted to:
 *
 *    color: var(--foo_-_color);
 *    background: var(--foo_-_background);
 *
 * This approach generally works but there are some issues and limitations.
 * Consider, for example, that somewhere *between* where `--foo` is set and used,
 * another element sets it to:
 *
 *    --foo: { border: 2px solid red; }
 *
 * We must now ensure that the color and background from the previous setting
 * do not apply. This is accomplished by changing the property set to this:
 *
 *    --foo_-_border: 2px solid red;
 *    --foo_-_color: initial;
 *    --foo_-_background: initial;
 *
 * This works but introduces one new issue.
 * Consider this setup at the point where the `@apply` is used:
 *
 *    background: orange;
 *    @apply --foo;
 *
 * In this case the background will be unset (initial) rather than the desired
 * `orange`. We address this by altering the property set to use a fallback
 * value like this:
 *
 *    color: var(--foo_-_color);
 *    background: var(--foo_-_background, orange);
 *    border: var(--foo_-_border);
 *
 * Note that the default is retained in the property set and the `background` is
 * the desired `orange`. This leads us to a limitation.
 *
 * Limitation 1:

 * Only properties in the rule where the `@apply`
 * is used are considered as default values.
 * If another rule matches the element and sets `background` with
 * less specificity than the rule in which `@apply` appears,
 * the `background` will not be set.
 *
 * Limitation 2:
 *
 * When using Polymer's `updateStyles` api, new properties may not be set for
 * `@apply` properties.

*/

  var MIXIN_MATCH = rx.MIXIN_MATCH
  var VAR_ASSIGN = rx.VAR_ASSIGN

  var APPLY_NAME_CLEAN = /;\s*/m
  var INITIAL_INHERIT = /^\s*(initial)|(inherit)\s*$/

// separator used between mixin-name and mixin-property-name when producing properties
// NOTE: plain '-' may cause collisions in user styles
  var MIXIN_VAR_SEP = '_-_'

// map of mixin to property names
// --foo: {border: 2px} -> {properties: {(--foo, ['border'])}, dependants: {'element-name': proto}}

  var MixinMap = (function () {
    function MixinMap () {
      classCallCheck(this, MixinMap)

      this._map = {}
    }

    createClass(MixinMap, [{
      key: 'set',
      value: function set (name, props) {
        name = name.trim()
        this._map[name] = {
          properties: props,
          dependants: {}
        }
      }
    }, {
      key: 'get',
      value: function get (name) {
        name = name.trim()
        return this._map[name]
      }
    }])
    return MixinMap
  }())

  var ApplyShim = (function () {
    function ApplyShim () {
      var _this = this

      classCallCheck(this, ApplyShim)

      this._currentTemplate = null
      this._measureElement = null
      this._map = new MixinMap()
      this._separator = MIXIN_VAR_SEP
      this._boundProduceCssProperties = function (matchText, propertyName, valueProperty, valueMixin) {
        return _this._produceCssProperties(matchText, propertyName, valueProperty, valueMixin)
      }
    }

    createClass(ApplyShim, [{
      key: 'transformStyle',
      value: function transformStyle (style, elementName) {
        var ast = rulesForStyle(style)
        this.transformRules(ast, elementName)
        return ast
      }
    }, {
      key: 'transformRules',
      value: function transformRules (rules, elementName) {
        var _this2 = this

        this._currentTemplate = templateMap[elementName]
        forEachRule(rules, function (r) {
          _this2.transformRule(r)
        })
        if (this._currentTemplate) {
          this._currentTemplate.__applyShimInvalid = false
        }
        this._currentTemplate = null
      }
    }, {
      key: 'transformRule',
      value: function transformRule (rule) {
        rule.cssText = this.transformCssText(rule.parsedCssText)
      // :root was only used for variable assignment in property shim,
      // but generates invalid selectors with real properties.
      // replace with `:host > *`, which serves the same effect
        if (rule.selector === ':root') {
          rule.selector = ':host > *'
        }
      }
    }, {
      key: 'transformCssText',
      value: function transformCssText (cssText) {
      // produce variables
        cssText = cssText.replace(VAR_ASSIGN, this._boundProduceCssProperties)
      // consume mixins
        return this._consumeCssProperties(cssText)
      }
    }, {
      key: '_getInitialValueForProperty',
      value: function _getInitialValueForProperty (property) {
        if (!this._measureElement) {
          this._measureElement = document.createElement('meta')
          this._measureElement.style.all = 'initial'
          document.head.appendChild(this._measureElement)
        }
        return window.getComputedStyle(this._measureElement).getPropertyValue(property)
      }
    // replace mixin consumption with variable consumption

    }, {
      key: '_consumeCssProperties',
      value: function _consumeCssProperties (text) {
        var m = void 0
      // loop over text until all mixins with defintions have been applied
        while (m = MIXIN_MATCH.exec(text)) {
          var matchText = m[0]
          var mixinName = m[1]
          var idx = m.index
        // collect properties before apply to be "defaults" if mixin might override them
        // match includes a "prefix", so find the start and end positions of @apply
          var applyPos = idx + matchText.indexOf('@apply')
          var afterApplyPos = idx + matchText.length
        // find props defined before this @apply
          var textBeforeApply = text.slice(0, applyPos)
          var textAfterApply = text.slice(afterApplyPos)
          var defaults$$1 = this._cssTextToMap(textBeforeApply)
          var replacement = this._atApplyToCssProperties(mixinName, defaults$$1)
        // use regex match position to replace mixin, keep linear processing time
          text = [textBeforeApply, replacement, textAfterApply].join('')
        // move regex search to _after_ replacement
          MIXIN_MATCH.lastIndex = idx + replacement.length
        }
        return text
      }
    // produce variable consumption at the site of mixin consumption
    // @apply --foo; -> for all props (${propname}: var(--foo_-_${propname}, ${fallback[propname]}}))
    // Example:
    // border: var(--foo_-_border); padding: var(--foo_-_padding, 2px)

    }, {
      key: '_atApplyToCssProperties',
      value: function _atApplyToCssProperties (mixinName, fallbacks) {
        mixinName = mixinName.replace(APPLY_NAME_CLEAN, '')
        var vars = []
        var mixinEntry = this._map.get(mixinName)
      // if we depend on a mixin before it is created
      // make a sentinel entry in the map to add this element as a dependency for when it is defined.
        if (!mixinEntry) {
          this._map.set(mixinName, {})
          mixinEntry = this._map.get(mixinName)
        }
        if (mixinEntry) {
          if (this._currentTemplate) {
            mixinEntry.dependants[this._currentTemplate.name] = this._currentTemplate
          }
          var p = void 0,
            parts = void 0,
            f = void 0
          for (p in mixinEntry.properties) {
            f = fallbacks && fallbacks[p]
            parts = [p, ': var(', mixinName, MIXIN_VAR_SEP, p]
            if (f) {
              parts.push(',', f)
            }
            parts.push(')')
            vars.push(parts.join(''))
          }
        }
        return vars.join('; ')
      }
    }, {
      key: '_replaceInitialOrInherit',
      value: function _replaceInitialOrInherit (property, value) {
        var match = INITIAL_INHERIT.exec(value)
        if (match) {
          if (match[1]) {
          // initial
          // replace `initial` with the concrete initial value for this property
            value = ApplyShim._getInitialValueForProperty(property)
          } else {
          // inherit
          // with this purposfully illegal value, the variable will be invalid at
          // compute time (https://www.w3.org/TR/css-variables/#invalid-at-computed-value-time)
          // and for inheriting values, will behave similarly
          // we cannot support the same behavior for non inheriting values like 'border'
            value = 'apply-shim-inherit'
          }
        }
        return value
      }

    // "parse" a mixin definition into a map of properties and values
    // cssTextToMap('border: 2px solid black') -> ('border', '2px solid black')

    }, {
      key: '_cssTextToMap',
      value: function _cssTextToMap (text) {
        var props = text.split(';')
        var property = void 0,
          value = void 0
        var out = {}
        for (var i = 0, p, sp; i < props.length; i++) {
          p = props[i]
          if (p) {
            sp = p.split(':')
          // ignore lines that aren't definitions like @media
            if (sp.length > 1) {
              property = sp[0].trim()
            // some properties may have ':' in the value, like data urls
              value = this._replaceInitialOrInherit(property, sp.slice(1).join(':'))
              out[property] = value
            }
          }
        }
        return out
      }
    }, {
      key: '_invalidateMixinEntry',
      value: function _invalidateMixinEntry (mixinEntry) {
        for (var elementName in mixinEntry.dependants) {
          if (elementName !== this._currentTemplate) {
            mixinEntry.dependants[elementName].__applyShimInvalid = true
          }
        }
      }
    }, {
      key: '_produceCssProperties',
      value: function _produceCssProperties (matchText, propertyName, valueProperty, valueMixin) {
        var _this3 = this

      // handle case where property value is a mixin
        if (valueProperty) {
        // form: --mixin2: var(--mixin1), where --mixin1 is in the map
          processVariableAndFallback(valueProperty, function (prefix, value) {
            if (value && _this3._map.get(value)) {
              valueMixin = '@apply ' + value + ';'
            }
          })
        }
        if (!valueMixin) {
          return matchText
        }
        var mixinAsProperties = this._consumeCssProperties(valueMixin)
        var prefix = matchText.slice(0, matchText.indexOf('--'))
        var mixinValues = this._cssTextToMap(mixinAsProperties)
        var combinedProps = mixinValues
        var mixinEntry = this._map.get(propertyName)
        var oldProps = mixinEntry && mixinEntry.properties
        if (oldProps) {
        // NOTE: since we use mixin, the map of properties is updated here
        // and this is what we want.
          combinedProps = Object.assign(Object.create(oldProps), mixinValues)
        } else {
          this._map.set(propertyName, combinedProps)
        }
        var out = []
        var p = void 0,
          v = void 0
      // set variables defined by current mixin
        var needToInvalidate = false
        for (p in combinedProps) {
          v = mixinValues[p]
        // if property not defined by current mixin, set initial
          if (v === undefined) {
            v = 'initial'
          }
          if (oldProps && !(p in oldProps)) {
            needToInvalidate = true
          }
          out.push(propertyName + MIXIN_VAR_SEP + p + ': ' + v)
        }
        if (needToInvalidate) {
          this._invalidateMixinEntry(mixinEntry)
        }
        if (mixinEntry) {
          mixinEntry.properties = combinedProps
        }
      // because the mixinMap is global, the mixin might conflict with
      // a different scope's simple variable definition:
      // Example:
      // some style somewhere:
      // --mixin1:{ ... }
      // --mixin2: var(--mixin1);
      // some other element:
      // --mixin1: 10px solid red;
      // --foo: var(--mixin1);
      // In this case, we leave the original variable definition in place.
        if (valueProperty) {
          prefix = matchText + ';' + prefix
        }
        return prefix + out.join('; ') + ';'
      }
    }])
    return ApplyShim
  }())

  var applyShim = new ApplyShim()
  window['ApplyShim'] = applyShim

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

  var flush = function flush () {}

  if (!nativeShadow) {
    (function () {
      var elementNeedsScoping = function elementNeedsScoping (element) {
        return element.classList && !element.classList.contains(StyleTransformer.SCOPE_NAME) ||
      // note: necessary for IE11
      element instanceof SVGElement && (!element.hasAttribute('class') || element.getAttribute('class').indexOf(StyleTransformer.SCOPE_NAME) < 0)
      }

      var handler = function handler (mxns) {
        for (var x = 0; x < mxns.length; x++) {
          var mxn = mxns[x]
          if (mxn.target === document.documentElement || mxn.target === document.head) {
            continue
          }
          for (var i = 0; i < mxn.addedNodes.length; i++) {
            var n = mxn.addedNodes[i]
            if (elementNeedsScoping(n)) {
              var root = n.getRootNode()
              if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
              // may no longer be in a shadowroot
                var host = root.host
                if (host) {
                  var scope = host.is || host.localName
                  StyleTransformer.dom(n, scope)
                }
              }
            }
          }
          for (var _i = 0; _i < mxn.removedNodes.length; _i++) {
            var _n = mxn.removedNodes[_i]
            if (_n.nodeType === Node.ELEMENT_NODE) {
              var classes
              if (_n.classList) {
                classes = Array.from(_n.classList)
              } else if (_n.hasAttribute('class')) {
                classes = _n.getAttribute('class').split(/\s+/)
              }
              if (classes !== undefined) {
              // NOTE: relies on the scoping class always being adjacent to the
              // SCOPE_NAME class.
                var classIdx = classes.indexOf(StyleTransformer.SCOPE_NAME)
                if (classIdx >= 0) {
                  var _scope = classes[classIdx + 1]
                  if (_scope) {
                    StyleTransformer.dom(_n, _scope, true)
                  }
                }
              }
            }
          }
        }
      }

      var observer = new MutationObserver(handler)
      var start = function start (node) {
        observer.observe(node, { childList: true, subtree: true })
      }
      var nativeCustomElements = window.customElements && !window.customElements.flush
    // need to start immediately with native custom elements
    // TODO(dfreedm): with polyfilled HTMLImports and native custom elements
    // excessive mutations may be observed; this can be optimized via cooperation
    // with the HTMLImports polyfill.
      if (nativeCustomElements) {
        start(document)
      } else {
        (function () {
          var delayedStart = function delayedStart () {
            start(document.body)
          }
        // use polyfill timing if it's available
          if (window.HTMLImports) {
            window.HTMLImports.whenReady(delayedStart)
          // otherwise push beyond native imports being ready
          // which requires RAF + readystate interactive.
          } else {
            requestAnimationFrame(function () {
              if (document.readyState === 'loading') {
                (function () {
                  var listener = function listener () {
                    delayedStart()
                    document.removeEventListener('readystatechange', listener)
                  }
                  document.addEventListener('readystatechange', listener)
                })()
              } else {
                delayedStart()
              }
            })
          }
        })()
      }

      flush = function flush () {
        handler(observer.takeRecords())
      }
    })()
  }

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

// TODO(dfreedm): consider spliting into separate global
  var styleCache = new StyleCache()

  var ShadyCSS = {
    flush: flush,
    scopeCounter: {},
    nativeShadow: nativeShadow,
    nativeCss: nativeCssVariables,
    nativeCssApply: nativeCssApply,
    _documentOwner: document.documentElement,
    _documentOwnerStyleInfo: StyleInfo.set(document.documentElement, new StyleInfo({ rules: [] })),
    _generateScopeSelector: function _generateScopeSelector (name) {
      var id = this.scopeCounter[name] = (this.scopeCounter[name] || 0) + 1
      return name + '-' + id
    },
    getStyleAst: function getStyleAst (style) {
      return rulesForStyle(style)
    },
    styleAstToString: function styleAstToString (ast) {
      return toCssText(ast)
    },
    _gatherStyles: function _gatherStyles (template) {
      var styles = template.content.querySelectorAll('style')
      var cssText = []
      for (var i = 0; i < styles.length; i++) {
        var s = styles[i]
        cssText.push(s.textContent)
        s.parentNode.removeChild(s)
      }
      return cssText.join('').trim()
    },
    _getCssBuild: function _getCssBuild (template) {
      var style = template.content.querySelector('style')
      if (!style) {
        return ''
      }
      return style.getAttribute('css-build') || ''
    },
    prepareTemplate: function prepareTemplate (template, elementName, typeExtension) {
      if (template._prepared) {
        return
      }
      template._prepared = true
      template.name = elementName
      template.extends = typeExtension
      templateMap[elementName] = template
      var cssBuild = this._getCssBuild(template)
      var cssText = this._gatherStyles(template)
      var info = {
        is: elementName,
        extends: typeExtension,
        __cssBuild: cssBuild
      }
      if (!this.nativeShadow) {
        StyleTransformer.dom(template.content, elementName)
      }
      var ast = parse(cssText)
      if (this.nativeCss && !this.nativeCssApply) {
        applyShim.transformRules(ast, elementName)
      }
      template._styleAst = ast

      var ownPropertyNames = []
      if (!this.nativeCss) {
        ownPropertyNames = StyleProperties.decorateStyles(template._styleAst, info)
      }
      if (!ownPropertyNames.length || this.nativeCss) {
        var root = this.nativeShadow ? template.content : null
        var placeholder = placeholderMap[elementName]
        var style = this._generateStaticStyle(info, template._styleAst, root, placeholder)
        template._style = style
      }
      template._ownPropertyNames = ownPropertyNames
    },
    _generateStaticStyle: function _generateStaticStyle (info, rules, shadowroot, placeholder) {
      var cssText = StyleTransformer.elementStyles(info, rules)
      if (cssText.length) {
        return applyCss(cssText, info.is, shadowroot, placeholder)
      }
    },
    _prepareHost: function _prepareHost (host) {
      var is = host.getAttribute('is') || host.localName
      var typeExtension = void 0
      if (is !== host.localName) {
        typeExtension = host.localName
      }
      var placeholder = placeholderMap[is]
      var template = templateMap[is]
      var ast = void 0
      var ownStylePropertyNames = void 0
      var cssBuild = void 0
      if (template) {
        ast = template._styleAst
        ownStylePropertyNames = template._ownPropertyNames
        cssBuild = template._cssBuild
      }
      return StyleInfo.set(host, new StyleInfo(ast, placeholder, ownStylePropertyNames, is, typeExtension, cssBuild))
    },
    applyStyle: function applyStyle (host, overrideProps) {
      var is = host.getAttribute('is') || host.localName
      if (window.CustomStyle) {
        var CS = window.CustomStyle
        if (CS._documentDirty) {
          CS.findStyles()
          if (!this.nativeCss) {
            this._updateProperties(this._documentOwner, this._documentOwnerStyleInfo)
          } else if (!this.nativeCssApply) {
            CS._revalidateApplyShim()
          }
          CS.applyStyles()
          CS._documentDirty = false
        }
      }
      var styleInfo = StyleInfo.get(host)
      var hasApplied = Boolean(styleInfo)
      if (!styleInfo) {
        styleInfo = this._prepareHost(host)
      }
      if (overrideProps) {
        styleInfo.overrideStyleProperties = styleInfo.overrideStyleProperties || {}
        Object.assign(styleInfo.overrideStyleProperties, overrideProps)
      }
      if (this.nativeCss) {
        var template = templateMap[is]
        if (template && template.__applyShimInvalid && template._style) {
        // update template
          applyShim.transformRules(template._styleAst, is)
          template._style.textContent = StyleTransformer.elementStyles(host, styleInfo.styleRules)
        // update instance if native shadowdom
          if (this.nativeShadow) {
            var style = host.shadowRoot.querySelector('style')
            style.textContent = StyleTransformer.elementStyles(host, styleInfo.styleRules)
          }
          styleInfo.styleRules = template._styleAst
        }
        this._updateNativeProperties(host, styleInfo.overrideStyleProperties)
      } else {
        this._updateProperties(host, styleInfo)
        if (styleInfo.ownStylePropertyNames && styleInfo.ownStylePropertyNames.length) {
        // TODO: use caching
          this._applyStyleProperties(host, styleInfo)
        }
      }
      if (hasApplied) {
        var root = this._isRootOwner(host) ? host : host.shadowRoot
      // note: some elements may not have a root!
        if (root) {
          this._applyToDescendants(root)
        }
      }
    },
    _applyToDescendants: function _applyToDescendants (root) {
      var c$ = root.children
      for (var i = 0, c; i < c$.length; i++) {
        c = c$[i]
        if (c.shadowRoot) {
          this.applyStyle(c)
        }
        this._applyToDescendants(c)
      }
    },
    _styleOwnerForNode: function _styleOwnerForNode (node) {
      var root = node.getRootNode()
      var host = root.host
      if (host) {
        if (StyleInfo.get(host)) {
          return host
        } else {
          return this._styleOwnerForNode(host)
        }
      }
      return this._documentOwner
    },
    _isRootOwner: function _isRootOwner (node) {
      return node === this._documentOwner
    },
    _applyStyleProperties: function _applyStyleProperties (host, styleInfo) {
      var is = host.getAttribute('is') || host.localName
      var cacheEntry = styleCache.fetch(is, styleInfo.styleProperties, styleInfo.ownStylePropertyNames)
      var cachedScopeSelector = cacheEntry && cacheEntry.scopeSelector
      var cachedStyle = cacheEntry ? cacheEntry.styleElement : null
      var oldScopeSelector = styleInfo.scopeSelector
    // only generate new scope if cached style is not found
      styleInfo.scopeSelector = cachedScopeSelector || this._generateScopeSelector(is)
      var style = StyleProperties.applyElementStyle(host, styleInfo.styleProperties, styleInfo.scopeSelector, cachedStyle)
      if (!this.nativeShadow) {
        StyleProperties.applyElementScopeSelector(host, styleInfo.scopeSelector, oldScopeSelector)
      }
      if (!cacheEntry) {
        styleCache.store(is, styleInfo.styleProperties, style, styleInfo.scopeSelector)
      }
      return style
    },
    _updateProperties: function _updateProperties (host, styleInfo) {
      var owner = this._styleOwnerForNode(host)
      var ownerStyleInfo = StyleInfo.get(owner)
      var ownerProperties = ownerStyleInfo.styleProperties
      var props = Object.create(ownerProperties || null)
      var hostAndRootProps = StyleProperties.hostAndRootPropertiesForScope(host, styleInfo.styleRules)
      var propertyData = StyleProperties.propertyDataFromStyles(ownerStyleInfo.styleRules, host)
      var propertiesMatchingHost = propertyData.properties
      Object.assign(props, hostAndRootProps.hostProps, propertiesMatchingHost, hostAndRootProps.rootProps)
      this._mixinOverrideStyles(props, styleInfo.overrideStyleProperties)
      StyleProperties.reify(props)
      styleInfo.styleProperties = props
    },
    _mixinOverrideStyles: function _mixinOverrideStyles (props, overrides) {
      for (var p in overrides) {
        var v = overrides[p]
      // skip override props if they are not truthy or 0
      // in order to fall back to inherited values
        if (v || v === 0) {
          props[p] = v
        }
      }
    },
    _updateNativeProperties: function _updateNativeProperties (element, properties) {
    // remove previous properties
      for (var p in properties) {
      // NOTE: for bc with shim, don't apply null values.
        if (p === null) {
          element.style.removeProperty(p)
        } else {
          element.style.setProperty(p, properties[p])
        }
      }
    },
    updateStyles: function updateStyles (properties) {
      if (window.CustomStyle) {
        window.CustomStyle._documentDirty = true
      }
      this.applyStyle(this._documentOwner, properties)
    },

  /* Custom Style operations */
    _transformCustomStyleForDocument: function _transformCustomStyleForDocument (style) {
      var _this = this

      var ast = rulesForStyle(style)
      forEachRule(ast, function (rule) {
        if (nativeShadow) {
          StyleTransformer.normalizeRootSelector(rule)
        } else {
          StyleTransformer.documentRule(rule)
        }
        if (_this.nativeCss && !_this.nativeCssApply) {
          applyShim.transformRule(rule)
        }
      })
      if (this.nativeCss) {
        style.textContent = toCssText(ast)
      } else {
        this._documentOwnerStyleInfo.styleRules.rules.push(ast)
      }
    },
    _revalidateApplyShim: function _revalidateApplyShim (style) {
      if (this.nativeCss && !this.nativeCssApply) {
        var ast = rulesForStyle(style)
        applyShim.transformRules(ast)
        style.textContent = toCssText(ast)
      }
    },
    _applyCustomStyleToDocument: function _applyCustomStyleToDocument (style) {
      if (!this.nativeCss) {
        StyleProperties.applyCustomStyle(style, this._documentOwnerStyleInfo.styleProperties)
      }
    },
    getComputedStyleValue: function getComputedStyleValue (element, property) {
      var value = void 0
      if (!this.nativeCss) {
      // element is either a style host, or an ancestor of a style host
        var styleInfo = StyleInfo.get(element) || StyleInfo.get(this._styleOwnerForNode(element))
        value = styleInfo.styleProperties[property]
      }
    // fall back to the property value from the computed styling
      value = value || window.getComputedStyle(element).getPropertyValue(property)
    // trim whitespace that can come after the `:` in css
    // example: padding: 2px -> " 2px"
      return value.trim()
    },

  // given an element and a classString, replaces
  // the element's class with the provided classString and adds
  // any necessary ShadyCSS static and property based scoping selectors
    setElementClass: function setElementClass (element, classString) {
      var root = element.getRootNode()
      var classes = classString ? classString.split(/\s/) : []
      var scopeName = root.host && root.host.localName
    // If no scope, try to discover scope name from existing class.
    // This can occur if, for example, a template stamped element that
    // has been scoped is manipulated when not in a root.
      if (!scopeName) {
        var classAttr = element.getAttribute('class')
        if (classAttr) {
          var k$ = classAttr.split(/\s/)
          for (var i = 0; i < k$.length; i++) {
            if (k$[i] === StyleTransformer.SCOPE_NAME) {
              scopeName = k$[i + 1]
              break
            }
          }
        }
      }
      if (scopeName) {
        classes.push(StyleTransformer.SCOPE_NAME, scopeName)
      }
      if (!this.nativeCss) {
        var styleInfo = StyleInfo.get(element)
        if (styleInfo && styleInfo.scopeSelector) {
          classes.push(StyleProperties.XSCOPE_NAME, styleInfo.scopeSelector)
        }
      }
      setElementClassRaw(element, classes.join(' '))
    },
    _styleInfoForNode: function _styleInfoForNode (node) {
      return StyleInfo.get(node)
    }
  }

  window['ShadyCSS'] = ShadyCSS

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

/*
Wrapper over <style> elements to co-operate with ShadyCSS

Example:
<shady-style>
  <style>
  ...
  </style>
</shady-style>
*/

  var ShadyCSS$1 = window.ShadyCSS

  var enqueued = false

  var customStyles = []

  var hookFn = null

/*
If a page only has <custom-style> elements, it will flash unstyled content,
as all the instances will boot asynchronously after page load.

Calling ShadyCSS.updateStyles() will force the work to happen synchronously
*/
  function enqueueDocumentValidation () {
    if (enqueued) {
      return
    }
    enqueued = true
    if (window.HTMLImports) {
      window.HTMLImports.whenReady(validateDocument)
    } else if (document.readyState === 'complete') {
      validateDocument()
    } else {
      document.addEventListener('readystatechange', function () {
        if (document.readyState === 'complete') {
          validateDocument()
        }
      })
    }
  }

  function validateDocument () {
    requestAnimationFrame(function () {
      if (enqueued) {
        ShadyCSS$1.updateStyles()
        enqueued = false
      }
    })
  }

  function CustomStyle () {
  /*
  Use Reflect to invoke the HTMLElement constructor, or rely on the
  CustomElement polyfill replacement that can be `.call`ed
  */
    var self = window.Reflect && Reflect.construct ? Reflect.construct(HTMLElement, [], this.constructor || CustomStyle) : HTMLElement.call(this)
    customStyles.push(self)
    enqueueDocumentValidation()
    return self
  }

  Object.defineProperties(CustomStyle, {
  /*
  CustomStyle.processHook is provided to customize the <style> element child of
  a <custom-style> element before the <style> is processed by ShadyCSS
   The function must take a <style> element as input, and return nothing.
  */
    processHook: {
      get: function get () {
        return hookFn
      },
      set: function set (fn) {
        hookFn = fn
        return fn
      }
    },
    _customStyles: {
      get: function get () {
        return customStyles
      }
    },
    _documentDirty: {
      get: function get () {
        return enqueued
      },
      set: function set (value) {
        enqueued = value
        return value
      }
    }
  })

  CustomStyle.findStyles = function () {
    for (var i = 0; i < customStyles.length; i++) {
      customStyles[i]._findStyle()
    }
  }

  CustomStyle._revalidateApplyShim = function () {
    for (var i = 0; i < customStyles.length; i++) {
      var s = customStyles[i]
      if (s._style) {
        ShadyCSS$1._revalidateApplyShim(s._style)
      }
    }
  }

  CustomStyle.applyStyles = function () {
    for (var i = 0; i < customStyles.length; i++) {
      customStyles[i]._applyStyle()
    }
  }

  CustomStyle.prototype = Object.create(HTMLElement.prototype, {
    'constructor': {
      value: CustomStyle,
      configurable: true,
      writable: true
    }
  })

  CustomStyle.prototype._findStyle = function () {
    if (!this._style) {
      var style = this.querySelector('style')
      if (!style) {
        return
      }
    // HTMLImports polyfill may have cloned the style into the main document,
    // which is referenced with __appliedElement.
    // Also, we must copy over the attributes.
      if (style.__appliedElement) {
        for (var i = 0; i < style.attributes.length; i++) {
          var attr = style.attributes[i]
          style.__appliedElement.setAttribute(attr.name, attr.value)
        }
      }
      this._style = style.__appliedElement || style
      if (hookFn) {
        hookFn(this._style)
      }
      ShadyCSS$1._transformCustomStyleForDocument(this._style)
    }
  }

  CustomStyle.prototype._applyStyle = function () {
    if (this._style) {
      ShadyCSS$1._applyCustomStyleToDocument(this._style)
    }
  }

  window.customElements.define('custom-style', CustomStyle)
  window['CustomStyle'] = CustomStyle

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
/*
Small module to load ShadyCSS and CustomStyle together
*/
}())
