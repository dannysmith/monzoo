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

  var settings = window.ShadyDOM || {}

  settings.hasNativeShadowDOM = Boolean(Element.prototype.attachShadow && Node.prototype.getRootNode)

  settings.inUse = settings.force || !settings.hasNativeShadowDOM

  function isShadyRoot (obj) {
    return Boolean(obj.__localName === 'ShadyRoot')
  }

  var p = Element.prototype
  var matches = p.matches || p.matchesSelector ||
  p.mozMatchesSelector || p.msMatchesSelector ||
  p.oMatchesSelector || p.webkitMatchesSelector

  function matchesSelector (element, selector) {
    return matches.call(element, selector)
  }

  function copyOwnProperty (name, source, target) {
    var pd = Object.getOwnPropertyDescriptor(source, name)
    if (pd) {
      Object.defineProperty(target, name, pd)
    }
  }

  function extend (target, source) {
    if (target && source) {
      var n$ = Object.getOwnPropertyNames(source)
      for (var i = 0, n; (i < n$.length) && (n = n$[i]); i++) {
        copyOwnProperty(n, source, target)
      }
    }
    return target || source
  }

  function extendAll (target) {
    var sources = [], len = arguments.length - 1
    while (len-- > 0) sources[ len ] = arguments[ len + 1 ]

    for (var i = 0; i < sources.length; i++) {
      extend(target, sources[i])
    }
    return target
  }

  function mixin (target, source) {
    for (var i in source) {
      target[i] = source[i]
    }
    return target
  }

  var setPrototypeOf = Object.setPrototypeOf || function (obj, proto) {
    obj.__proto__ = proto
    return obj
  }

  function patchPrototype (obj, mixin) {
    var proto = Object.getPrototypeOf(obj)
    if (!proto.hasOwnProperty('__patchProto')) {
      var patchProto = Object.create(proto)
      patchProto.__sourceProto = proto
      extend(patchProto, mixin)
      proto.__patchProto = patchProto
    }
    setPrototypeOf(obj, proto.__patchProto)
  }

  var common = {}

// TODO(sorvell): actually rely on a real Promise polyfill...
  var promish
  if (window.Promise) {
    promish = Promise.resolve()
  } else {
    promish = {
      then: function (cb) {
        var twiddle = document.createTextNode('')
        var observer = new MutationObserver(function () {
          observer.disconnect()
          cb()
        })
        observer.observe(twiddle, {characterData: true})
      }
    }
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

  function newSplice (index, removed, addedCount) {
    return {
      index: index,
      removed: removed,
      addedCount: addedCount
    }
  }

  var EDIT_LEAVE = 0
  var EDIT_UPDATE = 1
  var EDIT_ADD = 2
  var EDIT_DELETE = 3

  var ArraySplice = {

  // Note: This function is *based* on the computation of the Levenshtein
  // "edit" distance. The one change is that "updates" are treated as two
  // edits - not one. With Array splices, an update is really a delete
  // followed by an add. By retaining this, we optimize for "keeping" the
  // maximum array items in the original array. For example:
  //
  //   'xxxx123' -> '123yyyy'
  //
  // With 1-edit updates, the shortest path would be just to update all seven
  // characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
  // leaves the substring '123' intact.
    calcEditDistances: function calcEditDistances (current, currentStart, currentEnd,
                              old, oldStart, oldEnd) {
      var this$1 = this

    // "Deletion" columns
      var rowCount = oldEnd - oldStart + 1
      var columnCount = currentEnd - currentStart + 1
      var distances = new Array(rowCount)

    // "Addition" rows. Initialize null column.
      for (var i = 0; i < rowCount; i++) {
        distances[i] = new Array(columnCount)
        distances[i][0] = i
      }

    // Initialize null row
      for (var j = 0; j < columnCount; j++) {
        distances[0][j] = j
      }

      for (var i$1 = 1; i$1 < rowCount; i$1++) {
        for (var j$1 = 1; j$1 < columnCount; j$1++) {
          if (this$1.equals(current[currentStart + j$1 - 1], old[oldStart + i$1 - 1])) {
            distances[i$1][j$1] = distances[i$1 - 1][j$1 - 1]
          } else {
            var north = distances[i$1 - 1][j$1] + 1
            var west = distances[i$1][j$1 - 1] + 1
            distances[i$1][j$1] = north < west ? north : west
          }
        }
      }

      return distances
    },

  // This starts at the final weight, and walks "backward" by finding
  // the minimum previous weight recursively until the origin of the weight
  // matrix.
    spliceOperationsFromEditDistances: function spliceOperationsFromEditDistances (distances) {
      var i = distances.length - 1
      var j = distances[0].length - 1
      var current = distances[i][j]
      var edits = []
      while (i > 0 || j > 0) {
        if (i == 0) {
          edits.push(EDIT_ADD)
          j--
          continue
        }
        if (j == 0) {
          edits.push(EDIT_DELETE)
          i--
          continue
        }
        var northWest = distances[i - 1][j - 1]
        var west = distances[i - 1][j]
        var north = distances[i][j - 1]

        var min
        if (west < north) {
          min = west < northWest ? west : northWest
        } else {
          min = north < northWest ? north : northWest
        }

        if (min == northWest) {
          if (northWest == current) {
            edits.push(EDIT_LEAVE)
          } else {
            edits.push(EDIT_UPDATE)
            current = northWest
          }
          i--
          j--
        } else if (min == west) {
          edits.push(EDIT_DELETE)
          i--
          current = west
        } else {
          edits.push(EDIT_ADD)
          j--
          current = north
        }
      }

      edits.reverse()
      return edits
    },

  /**
   * Splice Projection functions:
   *
   * A splice map is a representation of how a previous array of items
   * was transformed into a new array of items. Conceptually it is a list of
   * tuples of
   *
   *   <index, removed, addedCount>
   *
   * which are kept in ascending index order of. The tuple represents that at
   * the |index|, |removed| sequence of items were removed, and counting forward
   * from |index|, |addedCount| items were added.
   */

  /**
   * Lacking individual splice mutation information, the minimal set of
   * splices can be synthesized given the previous state and final state of an
   * array. The basic approach is to calculate the edit distance matrix and
   * choose the shortest path through it.
   *
   * Complexity: O(l * p)
   *   l: The length of the current array
   *   p: The length of the old array
   */
    calcSplices: function calcSplices (current, currentStart, currentEnd,
                        old, oldStart, oldEnd) {
      var prefixCount = 0
      var suffixCount = 0
      var splice

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart)
      if (currentStart == 0 && oldStart == 0) { prefixCount = this.sharedPrefix(current, old, minLength) }

      if (currentEnd == current.length && oldEnd == old.length) {
        suffixCount = this.sharedSuffix(current, old, minLength - prefixCount)
      }

      currentStart += prefixCount
      oldStart += prefixCount
      currentEnd -= suffixCount
      oldEnd -= suffixCount

      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0) {
        return []
      }

      if (currentStart == currentEnd) {
        splice = newSplice(currentStart, [], 0)
        while (oldStart < oldEnd) {
          splice.removed.push(old[oldStart++])
        }

        return [ splice ]
      } else if (oldStart == oldEnd) {
        return [ newSplice(currentStart, [], currentEnd - currentStart) ]
      }

      var ops = this.spliceOperationsFromEditDistances(
        this.calcEditDistances(current, currentStart, currentEnd,
                               old, oldStart, oldEnd))

      splice = undefined
      var splices = []
      var index = currentStart
      var oldIndex = oldStart
      for (var i = 0; i < ops.length; i++) {
        switch (ops[i]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice)
              splice = undefined
            }

            index++
            oldIndex++
            break
          case EDIT_UPDATE:
            if (!splice) { splice = newSplice(index, [], 0) }

            splice.addedCount++
            index++

            splice.removed.push(old[oldIndex])
            oldIndex++
            break
          case EDIT_ADD:
            if (!splice) {
              splice = newSplice(index, [], 0)
            }

            splice.addedCount++
            index++
            break
          case EDIT_DELETE:
            if (!splice) {
              splice = newSplice(index, [], 0)
            }

            splice.removed.push(old[oldIndex])
            oldIndex++
            break
        }
      }

      if (splice) {
        splices.push(splice)
      }
      return splices
    },

    sharedPrefix: function sharedPrefix (current, old, searchLength) {
      var this$1 = this

      for (var i = 0; i < searchLength; i++) {
        if (!this$1.equals(current[i], old[i])) {
          return i
        }
      }
      return searchLength
    },

    sharedSuffix: function sharedSuffix (current, old, searchLength) {
      var index1 = current.length
      var index2 = old.length
      var count = 0
      while (count < searchLength && this.equals(current[--index1], old[--index2])) {
        count++
      }

      return count
    },

    calculateSplices: function calculateSplices$1 (current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0,
                            previous.length)
    },

    equals: function equals (currentValue, previousValue) {
      return currentValue === previousValue
    }

  }

  var calculateSplices = function (current, previous) { return ArraySplice.calculateSplices(current, previous) }

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

// TODO(sorvell): circular (patch loads tree and tree loads patch)
// for now this is stuck on `utils`
// import {patchNode} from './patch'
// native add/remove
  var nativeInsertBefore = Element.prototype.insertBefore
  var nativeAppendChild = Element.prototype.appendChild
  var nativeRemoveChild = Element.prototype.removeChild

/**
 * `tree` is a dom manipulation library used by ShadyDom to
 * manipulate composed and logical trees.
 */
  var tree = {

  // sad but faster than slice...
    arrayCopyChildNodes: function arrayCopyChildNodes (parent) {
      var copy = [], i = 0
      for (var n = parent.firstChild; n; n = n.nextSibling) {
        copy[i++] = n
      }
      return copy
    },

    arrayCopyChildren: function arrayCopyChildren (parent) {
      var copy = [], i = 0
      for (var n = parent.firstElementChild; n; n = n.nextElementSibling) {
        copy[i++] = n
      }
      return copy
    },

    arrayCopy: function arrayCopy (a$) {
      var l = a$.length
      var copy = new Array(l)
      for (var i = 0; i < l; i++) {
        copy[i] = a$[i]
      }
      return copy
    },

    saveChildNodes: function saveChildNodes (node) {
      tree.Logical.saveChildNodes(node)
      if (!tree.Composed.hasParentNode(node)) {
        tree.Composed.saveComposedData(node)
      // tree.Composed.saveParentNode(node);
      }
      tree.Composed.saveChildNodes(node)
    }

  }

  tree.Logical = {

    hasParentNode: function hasParentNode (node) {
      return Boolean(node.__dom && node.__dom.parentNode)
    },

    hasChildNodes: function hasChildNodes (node) {
      return Boolean(node.__dom && node.__dom.childNodes !== undefined)
    },

    getChildNodes: function getChildNodes (node) {
    // note: we're distinguishing here between undefined and false-y:
    // hasChildNodes uses undefined check to see if this element has logical
    // children; the false-y check indicates whether or not we should rebuild
    // the cached childNodes array.
      return this.hasChildNodes(node) ? this._getChildNodes(node) :
      tree.Composed.getChildNodes(node)
    },

    _getChildNodes: function _getChildNodes (node) {
      if (!node.__dom.childNodes) {
        node.__dom.childNodes = []
        for (var n = this.getFirstChild(node); n; n = this.getNextSibling(n)) {
          node.__dom.childNodes.push(n)
        }
      }
      return node.__dom.childNodes
    },

  // NOTE: __dom can be created under 2 conditions: (1) an element has a
  // logical tree, or (2) an element is in a logical tree. In case (1), the
  // element will store firstChild/lastChild, and in case (2), the element
  // will store parentNode, nextSibling, previousSibling. This means that
  // the mere existence of __dom is not enough to know if the requested
  // logical data is available and instead we do an explicit undefined check.
    getParentNode: function getParentNode (node) {
      return node.__dom && node.__dom.parentNode !== undefined ?
      node.__dom.parentNode : tree.Composed.getParentNode(node)
    },

    getFirstChild: function getFirstChild (node) {
      return node.__dom && node.__dom.firstChild !== undefined ?
      node.__dom.firstChild : tree.Composed.getFirstChild(node)
    },

    getLastChild: function getLastChild (node) {
      return node.__dom && node.__dom.lastChild !== undefined ?
      node.__dom.lastChild : tree.Composed.getLastChild(node)
    },

    getNextSibling: function getNextSibling (node) {
      return node.__dom && node.__dom.nextSibling !== undefined ?
      node.__dom.nextSibling : tree.Composed.getNextSibling(node)
    },

    getPreviousSibling: function getPreviousSibling (node) {
      return node.__dom && node.__dom.previousSibling !== undefined ?
      node.__dom.previousSibling : tree.Composed.getPreviousSibling(node)
    },

    getFirstElementChild: function getFirstElementChild (node) {
      return node.__dom && node.__dom.firstChild !== undefined ?
      this._getFirstElementChild(node) :
      tree.Composed.getFirstElementChild(node)
    },

    _getFirstElementChild: function _getFirstElementChild (node) {
      var n = node.__dom.firstChild
      while (n && n.nodeType !== Node.ELEMENT_NODE) {
        n = n.__dom.nextSibling
      }
      return n
    },

    getLastElementChild: function getLastElementChild (node) {
      return node.__dom && node.__dom.lastChild !== undefined ?
      this._getLastElementChild(node) :
      tree.Composed.getLastElementChild(node)
    },

    _getLastElementChild: function _getLastElementChild (node) {
      var n = node.__dom.lastChild
      while (n && n.nodeType !== Node.ELEMENT_NODE) {
        n = n.__dom.previousSibling
      }
      return n
    },

    getNextElementSibling: function getNextElementSibling (node) {
      return node.__dom && node.__dom.nextSibling !== undefined ?
      this._getNextElementSibling(node) :
      tree.Composed.getNextElementSibling(node)
    },

    _getNextElementSibling: function _getNextElementSibling (node) {
      var this$1 = this

      var n = node.__dom.nextSibling
      while (n && n.nodeType !== Node.ELEMENT_NODE) {
        n = this$1.getNextSibling(n)
      }
      return n
    },

    getPreviousElementSibling: function getPreviousElementSibling (node) {
      return node.__dom && node.__dom.previousSibling !== undefined ?
      this._getPreviousElementSibling(node) :
      tree.Composed.getPreviousElementSibling(node)
    },

    _getPreviousElementSibling: function _getPreviousElementSibling (node) {
      var this$1 = this

      var n = node.__dom.previousSibling
      while (n && n.nodeType !== Node.ELEMENT_NODE) {
        n = this$1.getPreviousSibling(n)
      }
      return n
    },

  // Capture the list of light children. It's important to do this before we
  // start transforming the DOM into "rendered" state.
  // Children may be added to this list dynamically. It will be treated as the
  // source of truth for the light children of the element. This element's
  // actual children will be treated as the rendered state once this function
  // has been called.
    saveChildNodes: function saveChildNodes$1 (node) {
      if (!this.hasChildNodes(node)) {
        node.__dom = node.__dom || {}
        node.__dom.firstChild = node.firstChild
        node.__dom.lastChild = node.lastChild
        var c$ = node.__dom.childNodes = tree.arrayCopyChildNodes(node)
        for (var i = 0, n; (i < c$.length) && (n = c$[i]); i++) {
          n.__dom = n.__dom || {}
          n.__dom.parentNode = node
          n.__dom.nextSibling = c$[i + 1] || null
          n.__dom.previousSibling = c$[i - 1] || null
          common.patchNode(n)
        }
      }
    },

  // TODO(sorvell): may need to patch saveChildNodes iff the tree has
  // already been distributed.
  // NOTE: ensure `node` is patched...
    recordInsertBefore: function recordInsertBefore (node, container, ref_node) {
      var this$1 = this

      container.__dom.childNodes = null
    // handle document fragments
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        var c$ = tree.arrayCopyChildNodes(node)
        for (var i = 0; i < c$.length; i++) {
          this$1._linkNode(c$[i], container, ref_node)
        }
      // cleanup logical dom in doc fragment.
        node.__dom = node.__dom || {}
        node.__dom.firstChild = node.__dom.lastChild = null
        node.__dom.childNodes = null
      } else {
        this._linkNode(node, container, ref_node)
      }
    },

    _linkNode: function _linkNode (node, container, ref_node) {
      common.patchNode(node)
      ref_node = ref_node || null
      node.__dom = node.__dom || {}
      container.__dom = container.__dom || {}
      if (ref_node) {
        ref_node.__dom = ref_node.__dom || {}
      }
    // update ref_node.previousSibling <-> node
      node.__dom.previousSibling = ref_node ? ref_node.__dom.previousSibling :
      container.__dom.lastChild
      if (node.__dom.previousSibling) {
        node.__dom.previousSibling.__dom.nextSibling = node
      }
    // update node <-> ref_node
      node.__dom.nextSibling = ref_node
      if (node.__dom.nextSibling) {
        node.__dom.nextSibling.__dom.previousSibling = node
      }
    // update node <-> container
      node.__dom.parentNode = container
      if (ref_node) {
        if (ref_node === container.__dom.firstChild) {
          container.__dom.firstChild = node
        }
      } else {
        container.__dom.lastChild = node
        if (!container.__dom.firstChild) {
          container.__dom.firstChild = node
        }
      }
    // remove caching of childNodes
      container.__dom.childNodes = null
    },

    recordRemoveChild: function recordRemoveChild (node, container) {
      node.__dom = node.__dom || {}
      container.__dom = container.__dom || {}
      if (node === container.__dom.firstChild) {
        container.__dom.firstChild = node.__dom.nextSibling
      }
      if (node === container.__dom.lastChild) {
        container.__dom.lastChild = node.__dom.previousSibling
      }
      var p = node.__dom.previousSibling
      var n = node.__dom.nextSibling
      if (p) {
        p.__dom = p.__dom || {}
        p.__dom.nextSibling = n
      }
      if (n) {
        n.__dom = n.__dom || {}
        n.__dom.previousSibling = p
      }
    // When an element is removed, logical data is no longer tracked.
    // Explicitly set `undefined` here to indicate this. This is disginguished
    // from `null` which is set if info is null.
      node.__dom.parentNode = node.__dom.previousSibling =
      node.__dom.nextSibling = null
    // remove caching of childNodes
      container.__dom.childNodes = null
    }

  }

// TODO(sorvell): composed tree manipulation is made available
// (1) to maninpulate the composed tree, and (2) to track changes
// to the tree for optional patching pluggability.
  tree.Composed = {

    hasParentNode: function hasParentNode$1 (node) {
      return Boolean(node.__dom && node.__dom.$parentNode !== undefined)
    },

    hasChildNodes: function hasChildNodes$1 (node) {
      return Boolean(node.__dom && node.__dom.$childNodes !== undefined)
    },

    getChildNodes: function getChildNodes$1 (node) {
      return this.hasChildNodes(node) ? this._getChildNodes(node) :
      (!node.__patched && tree.arrayCopy(node.childNodes))
    },

    _getChildNodes: function _getChildNodes$1 (node) {
      if (!node.__dom.$childNodes) {
        node.__dom.$childNodes = []
        for (var n = node.__dom.$firstChild; n; n = n.__dom.$nextSibling) {
          node.__dom.$childNodes.push(n)
        }
      }
      return node.__dom.$childNodes
    },

    getComposedChildNodes: function getComposedChildNodes (node) {
      return node.__dom.$childNodes
    },

    getParentNode: function getParentNode$1 (node) {
      return this.hasParentNode(node) ? node.__dom.$parentNode :
      (!node.__patched && node.parentNode)
    },

    getFirstChild: function getFirstChild$1 (node) {
      return node.__patched ? node.__dom.$firstChild : node.firstChild
    },

    getLastChild: function getLastChild$1 (node) {
      return node.__patched ? node.__dom.$lastChild : node.lastChild
    },

    getNextSibling: function getNextSibling$1 (node) {
      return node.__patched ? node.__dom.$nextSibling : node.nextSibling
    },

    getPreviousSibling: function getPreviousSibling$1 (node) {
      return node.__patched ? node.__dom.$previousSibling : node.previousSibling
    },

    getFirstElementChild: function getFirstElementChild$1 (node) {
      return node.__patched ? this._getFirstElementChild(node) :
      node.firstElementChild
    },

    _getFirstElementChild: function _getFirstElementChild$1 (node) {
      var n = node.__dom.$firstChild
      while (n && n.nodeType !== Node.ELEMENT_NODE) {
        n = n.__dom.$nextSibling
      }
      return n
    },

    getLastElementChild: function getLastElementChild$1 (node) {
      return node.__patched ? this._getLastElementChild(node) :
      node.lastElementChild
    },

    _getLastElementChild: function _getLastElementChild$1 (node) {
      var n = node.__dom.$lastChild
      while (n && n.nodeType !== Node.ELEMENT_NODE) {
        n = n.__dom.$previousSibling
      }
      return n
    },

    getNextElementSibling: function getNextElementSibling$1 (node) {
      return node.__patched ? this._getNextElementSibling(node) :
      node.nextElementSibling
    },

    _getNextElementSibling: function _getNextElementSibling$1 (node) {
      var this$1 = this

      var n = node.__dom.$nextSibling
      while (n && n.nodeType !== Node.ELEMENT_NODE) {
        n = this$1.getNextSibling(n)
      }
      return n
    },

    getPreviousElementSibling: function getPreviousElementSibling$1 (node) {
      return node.__patched ? this._getPreviousElementSibling(node) :
      node.previousElementSibling
    },

    _getPreviousElementSibling: function _getPreviousElementSibling$1 (node) {
      var this$1 = this

      var n = node.__dom.$previousSibling
      while (n && n.nodeType !== Node.ELEMENT_NODE) {
        n = this$1.getPreviousSibling(n)
      }
      return n
    },

    saveChildNodes: function saveChildNodes$2 (node) {
      var this$1 = this

      if (!this.hasChildNodes(node)) {
        node.__dom = node.__dom || {}
        node.__dom.$firstChild = node.firstChild
        node.__dom.$lastChild = node.lastChild
        var c$ = node.__dom.$childNodes = tree.arrayCopyChildNodes(node)
        for (var i = 0, n; (i < c$.length) && (n = c$[i]); i++) {
          this$1.saveComposedData(n)
        }
      }
    },

    saveComposedData: function saveComposedData (node) {
      node.__dom = node.__dom || {}
      if (node.__dom.$parentNode === undefined) {
        node.__dom.$parentNode = node.parentNode
      }
      if (node.__dom.$nextSibling === undefined) {
        node.__dom.$nextSibling = node.nextSibling
      }
      if (node.__dom.$previousSibling === undefined) {
        node.__dom.$previousSibling = node.previousSibling
      }
    },

    recordInsertBefore: function recordInsertBefore$1 (node, container, ref_node) {
      var this$1 = this

      container.__dom.$childNodes = null
    // handle document fragments
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      // TODO(sorvell): remember this for patching:
      // the act of setting this info can affect patched nodes
      // getters; therefore capture childNodes before patching.
        for (var n = this.getFirstChild(node); n; n = this.getNextSibling(n)) {
          this$1._linkNode(n, container, ref_node)
        }
      } else {
        this._linkNode(node, container, ref_node)
      }
    },

    _linkNode: function _linkNode$1 (node, container, ref_node) {
      node.__dom = node.__dom || {}
      container.__dom = container.__dom || {}
      if (ref_node) {
        ref_node.__dom = ref_node.__dom || {}
      }
    // update ref_node.previousSibling <-> node
      node.__dom.$previousSibling = ref_node ? ref_node.__dom.$previousSibling :
      container.__dom.$lastChild
      if (node.__dom.$previousSibling) {
        node.__dom.$previousSibling.__dom.$nextSibling = node
      }
    // update node <-> ref_node
      node.__dom.$nextSibling = ref_node
      if (node.__dom.$nextSibling) {
        node.__dom.$nextSibling.__dom.$previousSibling = node
      }
    // update node <-> container
      node.__dom.$parentNode = container
      if (ref_node) {
        if (ref_node === container.__dom.$firstChild) {
          container.__dom.$firstChild = node
        }
      } else {
        container.__dom.$lastChild = node
        if (!container.__dom.$firstChild) {
          container.__dom.$firstChild = node
        }
      }
    // remove caching of childNodes
      container.__dom.$childNodes = null
    },

    recordRemoveChild: function recordRemoveChild$1 (node, container) {
      node.__dom = node.__dom || {}
      container.__dom = container.__dom || {}
      if (node === container.__dom.$firstChild) {
        container.__dom.$firstChild = node.__dom.$nextSibling
      }
      if (node === container.__dom.$lastChild) {
        container.__dom.$lastChild = node.__dom.$previousSibling
      }
      var p = node.__dom.$previousSibling
      var n = node.__dom.$nextSibling
      if (p) {
        p.__dom = p.__dom || {}
        p.__dom.$nextSibling = n
      }
      if (n) {
        n.__dom = n.__dom || {}
        n.__dom.$previousSibling = p
      }
      node.__dom.$parentNode = node.__dom.$previousSibling =
      node.__dom.$nextSibling = null
    // remove caching of childNodes
      container.__dom.$childNodes = null
    },

    clearChildNodes: function clearChildNodes (node) {
      var this$1 = this

      var c$ = this.getChildNodes(node)
      for (var i = 0, c; i < c$.length; i++) {
        c = c$[i]
        this$1.recordRemoveChild(c, node)
        nativeRemoveChild.call(node, c)
      }
    },

    saveParentNode: function saveParentNode (node) {
      node.__dom = node.__dom || {}
      node.__dom.$parentNode = node.parentNode
    },

    insertBefore: function insertBefore (parentNode, newChild, refChild) {
      this.saveChildNodes(parentNode)
    // remove from current location.
      this._addChild(parentNode, newChild, refChild)
      return nativeInsertBefore.call(parentNode, newChild, refChild || null)
    },

    appendChild: function appendChild (parentNode, newChild) {
      this.saveChildNodes(parentNode)
      this._addChild(parentNode, newChild)
      return nativeAppendChild.call(parentNode, newChild)
    },

    removeChild: function removeChild (parentNode, node) {
      var currentParent = this.getParentNode(node)
      this.saveChildNodes(parentNode)
      this._removeChild(parentNode, node)
      if (currentParent === parentNode) {
        return nativeRemoveChild.call(parentNode, node)
      }
    },

    _addChild: function _addChild (parentNode, newChild, refChild) {
      var this$1 = this

      var isFrag = (newChild.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
      var oldParent = this.getParentNode(newChild)
      if (oldParent) {
        this._removeChild(oldParent, newChild)
      }
      if (isFrag) {
        var c$ = this.getChildNodes(newChild)
        for (var i = 0; i < c$.length; i++) {
          var c = c$[i]
        // unlink document fragment children
          this$1._removeChild(newChild, c)
          this$1.recordInsertBefore(c, parentNode, refChild)
        }
      } else {
        this.recordInsertBefore(newChild, parentNode, refChild)
      }
    },

    _removeChild: function _removeChild (parentNode, node) {
      this.recordRemoveChild(node, parentNode)
    }

  }

// for testing...
  var descriptors = {}
  function getNativeProperty (element, property) {
    if (!descriptors[property]) {
      descriptors[property] = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype, property) ||
    Object.getOwnPropertyDescriptor(
      Element.prototype, property) ||
    Object.getOwnPropertyDescriptor(
      Node.prototype, property)
    }
    return descriptors[property].get.call(element)
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

// NOTE: normalize event contruction where necessary (IE11)
  var NormalizedEvent = typeof Event === 'function' ? Event :
  function (inType, params) {
    params = params || {}
    var e = document.createEvent('Event')
    e.initEvent(inType, Boolean(params.bubbles), Boolean(params.cancelable))
    return e
  }

  var Distributor = (function () {
    function anonymous (root) {
      this.root = root
      this.insertionPointTag = 'slot'
    }

    anonymous.prototype.getInsertionPoints = function getInsertionPoints () {
      return this.root.querySelectorAll(this.insertionPointTag)
    }

    anonymous.prototype.hasInsertionPoint = function hasInsertionPoint () {
      return Boolean(this.root._insertionPoints &&
      this.root._insertionPoints.length)
    }

    anonymous.prototype.isInsertionPoint = function isInsertionPoint (node) {
      return node.localName && node.localName == this.insertionPointTag
    }

    anonymous.prototype.distribute = function distribute () {
      if (this.hasInsertionPoint()) {
        return this.distributePool(this.root, this.collectPool())
      }
      return []
    }

  // Gather the pool of nodes that should be distributed. We will combine
  // these with the "content root" to arrive at the composed tree.
    anonymous.prototype.collectPool = function collectPool () {
      return tree.arrayCopy(
      tree.Logical.getChildNodes(this.root.host))
    }

  // perform "logical" distribution; note, no actual dom is moved here,
  // instead elements are distributed into storage
  // array where applicable.
    anonymous.prototype.distributePool = function distributePool (node, pool) {
      var this$1 = this

      var dirtyRoots = []
      var p$ = this.root._insertionPoints
      for (var i = 0, l = p$.length, p; (i < l) && (p = p$[i]); i++) {
        this$1.distributeInsertionPoint(p, pool)
      // provoke redistribution on insertion point parents
      // must do this on all candidate hosts since distribution in this
      // scope invalidates their distribution.
      // only get logical parent.
        var parent = tree.Logical.getParentNode(p)
        if (parent && parent.shadyRoot &&
          this$1.hasInsertionPoint(parent.shadyRoot)) {
          dirtyRoots.push(parent.shadyRoot)
        }
      }
      for (var i$1 = 0; i$1 < pool.length; i$1++) {
        var p$1 = pool[i$1]
        if (p$1) {
          p$1._assignedSlot = undefined
        // remove undistributed elements from physical dom.
          var parent$1 = tree.Composed.getParentNode(p$1)
          if (parent$1) {
            tree.Composed.removeChild(parent$1, p$1)
          }
        }
      }
      return dirtyRoots
    }

    anonymous.prototype.distributeInsertionPoint = function distributeInsertionPoint (insertionPoint, pool) {
      var this$1 = this

      var prevAssignedNodes = insertionPoint._assignedNodes
      if (prevAssignedNodes) {
        this.clearAssignedSlots(insertionPoint, true)
      }
      insertionPoint._assignedNodes = []
      var needsSlotChange = false
    // distribute nodes from the pool that this selector matches
      var anyDistributed = false
      for (var i = 0, l = pool.length, node; i < l; i++) {
        node = pool[i]
      // skip nodes that were already used
        if (!node) {
          continue
        }
      // distribute this node if it matches
        if (this$1.matchesInsertionPoint(node, insertionPoint)) {
          if (node.__prevAssignedSlot != insertionPoint) {
            needsSlotChange = true
          }
          this$1.distributeNodeInto(node, insertionPoint)
        // remove this node from the pool
          pool[i] = undefined
        // since at least one node matched, we won't need fallback content
          anyDistributed = true
        }
      }
    // Fallback content if nothing was distributed here
      if (!anyDistributed) {
        var children = tree.Logical.getChildNodes(insertionPoint)
        for (var j = 0, node$1; j < children.length; j++) {
          node$1 = children[j]
          if (node$1.__prevAssignedSlot != insertionPoint) {
            needsSlotChange = true
          }
          this$1.distributeNodeInto(node$1, insertionPoint)
        }
      }
    // we're already dirty if a node was newly added to the slot
    // and we're also dirty if the assigned count decreased.
      if (prevAssignedNodes) {
      // TODO(sorvell): the tracking of previously assigned slots
      // could instead by done with a Set and then we could
      // avoid needing to iterate here to clear the info.
        for (var i$1 = 0; i$1 < prevAssignedNodes.length; i$1++) {
          prevAssignedNodes[i$1].__prevAssignedSlot = null
        }
        if (insertionPoint._assignedNodes.length < prevAssignedNodes.length) {
          needsSlotChange = true
        }
      }
      this.setDistributedNodesOnInsertionPoint(insertionPoint)
      if (needsSlotChange) {
        this._fireSlotChange(insertionPoint)
      }
    }

    anonymous.prototype.clearAssignedSlots = function clearAssignedSlots (slot, savePrevious) {
      var n$ = slot._assignedNodes
      if (n$) {
        for (var i = 0; i < n$.length; i++) {
          var n = n$[i]
          if (savePrevious) {
            n.__prevAssignedSlot = n._assignedSlot
          }
        // only clear if it was previously set to this slot;
        // this helps ensure that if the node has otherwise been distributed
        // ignore it.
          if (n._assignedSlot === slot) {
            n._assignedSlot = null
          }
        }
      }
    }

    anonymous.prototype.matchesInsertionPoint = function matchesInsertionPoint (node, insertionPoint) {
      var slotName = insertionPoint.getAttribute('name')
      slotName = slotName ? slotName.trim() : ''
      var slot = node.getAttribute && node.getAttribute('slot')
      slot = slot ? slot.trim() : ''
      return (slot == slotName)
    }

    anonymous.prototype.distributeNodeInto = function distributeNodeInto (child, insertionPoint) {
      insertionPoint._assignedNodes.push(child)
      child._assignedSlot = insertionPoint
    }

    anonymous.prototype.setDistributedNodesOnInsertionPoint = function setDistributedNodesOnInsertionPoint (insertionPoint) {
      var this$1 = this

      var n$ = insertionPoint._assignedNodes
      insertionPoint._distributedNodes = []
      for (var i = 0, n; (i < n$.length) && (n = n$[i]); i++) {
        if (this$1.isInsertionPoint(n)) {
          var d$ = n._distributedNodes
          if (d$) {
            for (var j = 0; j < d$.length; j++) {
              insertionPoint._distributedNodes.push(d$[j])
            }
          }
        } else {
          insertionPoint._distributedNodes.push(n$[i])
        }
      }
    }

    anonymous.prototype._fireSlotChange = function _fireSlotChange (insertionPoint) {
    // NOTE: cannot bubble correctly here so not setting bubbles: true
    // Safari tech preview does not bubble but chrome does
    // Spec says it bubbles (https://dom.spec.whatwg.org/#mutation-observers)
      insertionPoint.dispatchEvent(new NormalizedEvent('slotchange'))
      if (insertionPoint._assignedSlot) {
        this._fireSlotChange(insertionPoint._assignedSlot)
      }
    }

    anonymous.prototype.isFinalDestination = function isFinalDestination (insertionPoint) {
      return !(insertionPoint._assignedSlot)
    }

    return anonymous
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
  Implements a pared down version of ShadowDOM's scoping, which is easy to
  polyfill across browsers.
*/
  var ShadyRoot = function ShadyRoot (host) {
    if (!host) {
      throw 'Must provide a host'
    }
  // NOTE: this strange construction is necessary because
  // DocumentFragment cannot be subclassed on older browsers.
    var frag = document.createDocumentFragment()
    frag.__proto__ = ShadyFragmentMixin
    frag._init(host)
    return frag
  }

  var ShadyMixin = {

    _init: function _init (host) {
    // NOTE: set a fake local name so this element can be
    // distinguished from a DocumentFragment when patching.
    // FF doesn't allow this to be `localName`
      this.__localName = 'ShadyRoot'
    // root <=> host
      host.shadyRoot = this
      this.host = host
    // logical dom setup
      tree.Logical.saveChildNodes(host)
      tree.Logical.saveChildNodes(this)
    // state flags
      this._clean = true
      this._hasRendered = false
      this._distributor = new Distributor(this)
      this.update()
    },

  // async render the "top" distributor (this is all that is needed to
  // distribute this host).
    update: function update () {
    // TODO(sorvell): instead the root should always be enqueued to helps record that it is dirty.
    // Then, in `render`, the top most (in the distribution tree) "dirty" root should be rendered.
      var distributionRoot = this._findDistributionRoot(this.host)
    // console.log('update from', this.host, 'root', distributionRoot.host, distributionRoot._clean);
      if (distributionRoot._clean) {
        distributionRoot._clean = false
        enqueue(function () {
          distributionRoot.render()
        })
      }
    },

  // TODO(sorvell): this may not return a shadowRoot (for example if the element is in a docFragment)
  // this should only return a shadowRoot.
  // returns the host that's the top of this host's distribution tree
    _findDistributionRoot: function _findDistributionRoot (element) {
      var root = element.shadyRoot
      while (element && this._elementNeedsDistribution(element)) {
        root = element.getRootNode()
        element = root && root.host
      }
      return root
    },

  // Return true if a host's children includes
  // an insertion point that selects selectively
    _elementNeedsDistribution: function _elementNeedsDistribution (element) {
      var this$1 = this

      var c$ = tree.Logical.getChildNodes(element)
      for (var i = 0, c; i < c$.length; i++) {
        c = c$[i]
        if (this$1._distributor.isInsertionPoint(c)) {
          return element.getRootNode()
        }
      }
    },

    render: function render () {
      if (!this._clean) {
        this._clean = true
        if (!this._skipUpdateInsertionPoints) {
          this.updateInsertionPoints()
        } else if (!this._hasRendered) {
          this._insertionPoints = []
        }
        this._skipUpdateInsertionPoints = false
      // TODO(sorvell): previous ShadyDom had a fast path here
      // that would avoid distribution for initial render if
      // no insertion points exist. We cannot currently do this because
      // it relies on elements being in the physical shadowRoot element
      // so that native methods will be used. The current append code
      // simply provokes distribution in this case and does not put the
      // nodes in the shadowRoot. This could be done but we'll need to
      // consider if the special processing is worth the perf gain.
      // if (!this._hasRendered && !this._insertionPoints.length) {
      //   tree.Composed.clearChildNodes(this.host);
      //   tree.Composed.appendChild(this.host, this);
      // } else {
      // logical
        this.distribute()
      // physical
        this.compose()
        this._hasRendered = true
      }
    },

    forceRender: function forceRender () {
      this._clean = false
      this.render()
    },

    distribute: function distribute () {
      var dirtyRoots = this._distributor.distribute()
      for (var i = 0; i < dirtyRoots.length; i++) {
        dirtyRoots[i].forceRender()
      }
    },

    updateInsertionPoints: function updateInsertionPoints () {
      var this$1 = this

      var i$ = this.__insertionPoints
    // if any insertion points have been removed, clear their distribution info
      if (i$) {
        for (var i = 0, c; i < i$.length; i++) {
          c = i$[i]
          if (c.getRootNode() !== this$1) {
            this$1._distributor.clearAssignedSlots(c)
          }
        }
      }
      i$ = this._insertionPoints = this._distributor.getInsertionPoints()
    // ensure insertionPoints's and their parents have logical dom info.
    // save logical tree info
    // a. for shadyRoot
    // b. for insertion points (fallback)
    // c. for parents of insertion points
      for (var i$1 = 0, c$1; i$1 < i$.length; i$1++) {
        c$1 = i$[i$1]
        tree.Logical.saveChildNodes(c$1)
        tree.Logical.saveChildNodes(tree.Logical.getParentNode(c$1))
      }
    },

    get _insertionPoints () {
      if (!this.__insertionPoints) {
        this.updateInsertionPoints()
      }
      return this.__insertionPoints || (this.__insertionPoints = [])
    },

    set _insertionPoints (insertionPoints) {
      this.__insertionPoints = insertionPoints
    },

    hasInsertionPoint: function hasInsertionPoint () {
      return this._distributor.hasInsertionPoint()
    },

    compose: function compose () {
    // compose self
    // note: it's important to mark this clean before distribution
    // so that attachment that provokes additional distribution (e.g.
    // adding something to your parentNode) works
      this._composeTree()
    // TODO(sorvell): See fast paths here in Polymer v1
    // (these seem unnecessary)
    },

  // Reify dom such that it is at its correct rendering position
  // based on logical distribution.
    _composeTree: function _composeTree () {
      var this$1 = this

      this._updateChildNodes(this.host, this._composeNode(this.host))
      var p$ = this._insertionPoints || []
      for (var i = 0, l = p$.length, p, parent; (i < l) && (p = p$[i]); i++) {
        parent = tree.Logical.getParentNode(p)
        if ((parent !== this$1.host) && (parent !== this$1)) {
          this$1._updateChildNodes(parent, this$1._composeNode(parent))
        }
      }
    },

  // Returns the list of nodes which should be rendered inside `node`.
    _composeNode: function _composeNode (node) {
      var this$1 = this

      var children = []
      var c$ = tree.Logical.getChildNodes(node.shadyRoot || node)
      for (var i = 0; i < c$.length; i++) {
        var child = c$[i]
        if (this$1._distributor.isInsertionPoint(child)) {
          var distributedNodes = child._distributedNodes ||
          (child._distributedNodes = [])
          for (var j = 0; j < distributedNodes.length; j++) {
            var distributedNode = distributedNodes[j]
            if (this$1.isFinalDestination(child, distributedNode)) {
              children.push(distributedNode)
            }
          }
        } else {
          children.push(child)
        }
      }
      return children
    },

    isFinalDestination: function isFinalDestination (insertionPoint, node) {
      return this._distributor.isFinalDestination(
      insertionPoint, node)
    },

  // Ensures that the rendered node list inside `container` is `children`.
    _updateChildNodes: function _updateChildNodes (container, children) {
      var composed = tree.Composed.getChildNodes(container)
      var splices = calculateSplices(children, composed)
    // process removals
      for (var i = 0, d = 0, s; (i < splices.length) && (s = splices[i]); i++) {
        for (var j = 0, n; (j < s.removed.length) && (n = s.removed[j]); j++) {
        // check if the node is still where we expect it is before trying
        // to remove it; this can happen if we move a node and
        // then schedule its previous host for distribution resulting in
        // the node being removed here.
          if (tree.Composed.getParentNode(n) === container) {
            tree.Composed.removeChild(container, n)
          }
          composed.splice(s.index + d, 1)
        }
        d -= s.addedCount
      }
    // process adds
      for (var i$1 = 0, s$1, next; (i$1 < splices.length) && (s$1 = splices[i$1]); i$1++) { //eslint -disable-line no-redeclare
        next = composed[s$1.index]
        for (var j$1 = s$1.index, n$1; j$1 < s$1.index + s$1.addedCount; j$1++) {
          n$1 = children[j$1]
          tree.Composed.insertBefore(container, n$1, next)
        // TODO(sorvell): is this splice strictly needed?
          composed.splice(j$1, 0, n$1)
        }
      }
    },

    getInsertionPointTag: function getInsertionPointTag () {
      return this._distributor.insertionPointTag
    }

  }

  var ShadyFragmentMixin = Object.create(DocumentFragment.prototype)
  extend(ShadyFragmentMixin, ShadyMixin)

// let needsUpgrade = window.CustomElements && !CustomElements.useNative;

// function upgradeLogicalChildren(children) {
//   if (needsUpgrade && children) {
//     for (let i=0; i < children.length; i++) {
//       CustomElements.upgrade(children[i]);
//     }
//   }
// }

// render enqueuer/flusher
  var customElements = window.customElements
  var flushList = []
  var scheduled
  var flushCount = 0
  var flushMax = 100
  function enqueue (callback) {
    if (!scheduled) {
      scheduled = true
      promish.then(flush$1)
    }
    flushList.push(callback)
  }

  function flush$1 () {
    scheduled = false
    flushCount++
    while (flushList.length) {
      flushList.shift()()
    }
    if (customElements && customElements.flush) {
      customElements.flush()
    }
  // continue flushing after elements are upgraded...
    var isFlushedMaxed = (flushCount > flushMax)
    if (flushList.length && !isFlushedMaxed) {
      flush$1()
    }
    flushCount = 0
    if (isFlushedMaxed) {
      throw new Error('Loop detected in ShadyDOM distribution, aborting.')
    }
  }

  flush$1.list = flushList

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

// Cribbed from ShadowDOM polyfill
// https://github.com/webcomponents/webcomponentsjs/blob/master/src/ShadowDOM/wrappers/HTMLElement.js#L28
// ///////////////////////////////////////////////////////////////////////////
// innerHTML and outerHTML

// http://www.whatwg.org/specs/web-apps/current-work/multipage/the-end.html#escapingString
  var escapeAttrRegExp = /[&\u00A0"]/g
  var escapeDataRegExp = /[&\u00A0<>]/g

  function escapeReplace (c) {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case '\u00A0':
        return '&nbsp;'
    }
  }

  function escapeAttr (s) {
    return s.replace(escapeAttrRegExp, escapeReplace)
  }

  function escapeData (s) {
    return s.replace(escapeDataRegExp, escapeReplace)
  }

  function makeSet (arr) {
    var set = {}
    for (var i = 0; i < arr.length; i++) {
      set[arr[i]] = true
    }
    return set
  }

// http://www.whatwg.org/specs/web-apps/current-work/#void-elements
  var voidElements = makeSet([
    'area',
    'base',
    'br',
    'col',
    'command',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
  ])

  var plaintextParents = makeSet([
    'style',
    'script',
    'xmp',
    'iframe',
    'noembed',
    'noframes',
    'plaintext',
    'noscript'
  ])

  function getOuterHTML (node, parentNode, composed) {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE: {
        var tagName = node.localName
        var s = '<' + tagName
        var attrs = node.attributes
        for (var i = 0, attr; (attr = attrs[i]); i++) {
          s += ' ' + attr.name + '="' + escapeAttr(attr.value) + '"'
        }
        s += '>'
        if (voidElements[tagName]) {
          return s
        }
        return s + getInnerHTML(node, composed) + '</' + tagName + '>'
      }
      case Node.TEXT_NODE: {
        var data = node.data
        if (parentNode && plaintextParents[parentNode.localName]) {
          return data
        }
        return escapeData(data)
      }
      case Node.COMMENT_NODE: {
        return '<!--' + node.data + '-->'
      }
      default: {
        window.console.error(node)
        throw new Error('not implemented')
      }
    }
  }

  function getInnerHTML (node, composed) {
    if (node.localName === 'template') {
      node = node.content
    }
    var s = ''
    var c$ = composed ? composed(node) : node.childNodes
    for (var i = 0, l = c$.length, child; (i < l) && (child = c$[i]); i++) {
      s += getOuterHTML(child, node, composed)
    }
    return s
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

  var mixinImpl = {

  // Try to add node. Record logical info, track insertion points, perform
  // distribution iff needed. Return true if the add is handled.
    addNode: function addNode (container, node, ref_node) {
      var ownerRoot = this.ownerShadyRootForNode(container)
      if (ownerRoot) {
      // optimization: special insertion point tracking
        if (node.__noInsertionPoint && ownerRoot._clean) {
          ownerRoot._skipUpdateInsertionPoints = true
        }
      // note: we always need to see if an insertion point is added
      // since this saves logical tree info; however, invalidation state
      // needs
        var ipAdded = this._maybeAddInsertionPoint(node, container, ownerRoot)
      // invalidate insertion points IFF not already invalid!
        if (ipAdded) {
          ownerRoot._skipUpdateInsertionPoints = false
        }
      }
      if (tree.Logical.hasChildNodes(container)) {
        tree.Logical.recordInsertBefore(node, container, ref_node)
      }
    // if not distributing and not adding to host, do a fast path addition
      var handled = this._maybeDistribute(node, container, ownerRoot) ||
      container.shadyRoot
      return handled
    },

  // Try to remove node: update logical info and perform distribution iff
  // needed. Return true if the removal has been handled.
  // note that it's possible for both the node's host and its parent
  // to require distribution... both cases are handled here.
    removeNode: function removeNode (node) {
    // important that we want to do this only if the node has a logical parent
      var logicalParent = tree.Logical.hasParentNode(node) &&
      tree.Logical.getParentNode(node)
      var distributed
      var ownerRoot = this.ownerShadyRootForNode(node)
      if (logicalParent) {
      // distribute node's parent iff needed
        distributed = this.maybeDistributeParent(node)
        tree.Logical.recordRemoveChild(node, logicalParent)
      // remove node from root and distribute it iff needed
        if (ownerRoot && (this._removeDistributedChildren(ownerRoot, node) ||
        logicalParent.localName === ownerRoot.getInsertionPointTag())) {
          ownerRoot._skipUpdateInsertionPoints = false
          ownerRoot.update()
        }
      }
      this._removeOwnerShadyRoot(node)
      return distributed
    },

    _scheduleObserver: function _scheduleObserver (node, addedNode, removedNode) {
      var observer = node.__dom && node.__dom.observer
      if (observer) {
        if (addedNode) {
          observer.addedNodes.push(addedNode)
        }
        if (removedNode) {
          observer.removedNodes.push(removedNode)
        }
        observer.schedule()
      }
    },

    removeNodeFromParent: function removeNodeFromParent (node, parent) {
      if (parent) {
        this._scheduleObserver(parent, null, node)
        this.removeNode(node)
      } else {
        this._removeOwnerShadyRoot(node)
      }
    },

    _hasCachedOwnerRoot: function _hasCachedOwnerRoot (node) {
      return Boolean(node.__ownerShadyRoot !== undefined)
    },

    getRootNode: function getRootNode$1 (node) {
      if (!node || !node.nodeType) {
        return
      }
      var root = node.__ownerShadyRoot
      if (root === undefined) {
        if (isShadyRoot(node)) {
          root = node
        } else {
          var parent = tree.Logical.getParentNode(node)
          root = parent ? this.getRootNode(parent) : node
        }
      // memo-ize result for performance but only memo-ize
      // result if node is in the document. This avoids a problem where a root
      // can be cached while an element is inside a fragment.
      // If this happens and we cache the result, the value can become stale
      // because for perf we avoid processing the subtree of added fragments.
        if (document.documentElement.contains(node)) {
          node.__ownerShadyRoot = root
        }
      }
      return root
    },

    ownerShadyRootForNode: function ownerShadyRootForNode (node) {
      var root = this.getRootNode(node)
      if (isShadyRoot(root)) {
        return root
      }
    },

    _maybeDistribute: function _maybeDistribute (node, container, ownerRoot) {
    // TODO(sorvell): technically we should check non-fragment nodes for
    // <content> children but since this case is assumed to be exceedingly
    // rare, we avoid the cost and will address with some specific api
    // when the need arises.  For now, the user must call
    // distributeContent(true), which updates insertion points manually
    // and forces distribution.
      var insertionPointTag = ownerRoot && ownerRoot.getInsertionPointTag() || ''
      var fragContent = (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) &&
      !node.__noInsertionPoint &&
      insertionPointTag && node.querySelector(insertionPointTag)
      var wrappedContent = fragContent &&
      (tree.Logical.getParentNode(fragContent).nodeType !==
      Node.DOCUMENT_FRAGMENT_NODE)
      var hasContent = fragContent || (node.localName === insertionPointTag)
    // There are 3 possible cases where a distribution may need to occur:
    // 1. <content> being inserted (the host of the shady root where
    //    content is inserted needs distribution)
    // 2. children being inserted into parent with a shady root (parent
    //    needs distribution)
    // 3. container is an insertionPoint
      if (hasContent || (container.localName === insertionPointTag)) {
        if (ownerRoot) {
        // note, insertion point list update is handled after node
        // mutations are complete
          ownerRoot.update()
        }
      }
      var needsDist = this._nodeNeedsDistribution(container)
      if (needsDist) {
        container.shadyRoot.update()
      }
    // Return true when distribution will fully handle the composition
    // Note that if a content was being inserted that was wrapped by a node,
    // and the parent does not need distribution, return false to allow
    // the nodes to be added directly, after which children may be
    // distributed and composed into the wrapping node(s)
      return needsDist || (hasContent && !wrappedContent)
    },

  /* note: parent argument is required since node may have an out
  of date parent at this point; returns true if a <content> is being added */
    _maybeAddInsertionPoint: function _maybeAddInsertionPoint (node, parent, root) {
      var this$1 = this

      var added
      var insertionPointTag = root.getInsertionPointTag()
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
      !node.__noInsertionPoint) {
        var c$ = node.querySelectorAll(insertionPointTag)
        for (var i = 0, n, np, na; (i < c$.length) && (n = c$[i]); i++) {
          np = tree.Logical.getParentNode(n)
        // don't allow node's parent to be fragment itself
          if (np === node) {
            np = parent
          }
          na = this$1._maybeAddInsertionPoint(n, np, root)
          added = added || na
        }
      } else if (node.localName === insertionPointTag) {
        tree.Logical.saveChildNodes(parent)
        tree.Logical.saveChildNodes(node)
        added = true
      }
      return added
    },

    _nodeNeedsDistribution: function _nodeNeedsDistribution (node) {
      return node && node.shadyRoot &&
      node.shadyRoot.hasInsertionPoint()
    },

    _removeDistributedChildren: function _removeDistributedChildren (root, container) {
      var this$1 = this

      var hostNeedsDist
      var ip$ = root._insertionPoints
      for (var i = 0; i < ip$.length; i++) {
        var insertionPoint = ip$[i]
        if (this$1._contains(container, insertionPoint)) {
          var dc$ = insertionPoint.assignedNodes({flatten: true})
          for (var j = 0; j < dc$.length; j++) {
            hostNeedsDist = true
            var node = dc$[j]
            var parent = tree.Composed.getParentNode(node)
            if (parent) {
              tree.Composed.removeChild(parent, node)
            }
          }
        }
      }
      return hostNeedsDist
    },

    _contains: function _contains (container, node) {
      while (node) {
        if (node == container) {
          return true
        }
        node = tree.Logical.getParentNode(node)
      }
    },

    _removeOwnerShadyRoot: function _removeOwnerShadyRoot (node) {
      var this$1 = this

    // optimization: only reset the tree if node is actually in a root
      if (this._hasCachedOwnerRoot(node)) {
        var c$ = tree.Logical.getChildNodes(node)
        for (var i = 0, l = c$.length, n; (i < l) && (n = c$[i]); i++) {
          this$1._removeOwnerShadyRoot(n)
        }
      }
      node.__ownerShadyRoot = undefined
    },

  // TODO(sorvell): This will fail if distribution that affects this
  // question is pending; this is expected to be exceedingly rare, but if
  // the issue comes up, we can force a flush in this case.
    firstComposedNode: function firstComposedNode (insertionPoint) {
      var n$ = insertionPoint.assignedNodes({flatten: true})
      var root = this.getRootNode(insertionPoint)
      for (var i = 0, l = n$.length, n; (i < l) && (n = n$[i]); i++) {
      // means that we're composed to this spot.
        if (root.isFinalDestination(insertionPoint, n)) {
          return n
        }
      }
    },

    clearNode: function clearNode (node) {
      while (node.firstChild) {
        node.removeChild(node.firstChild)
      }
    },

    maybeDistributeParent: function maybeDistributeParent (node) {
      var parent = tree.Logical.getParentNode(node)
      if (this._nodeNeedsDistribution(parent)) {
        parent.shadyRoot.update()
        return true
      }
    },

    maybeDistributeAttributeChange: function maybeDistributeAttributeChange (node, name) {
      if (name === 'slot') {
        this.maybeDistributeParent(node)
      } else if (node.localName === 'slot' && name === 'name') {
        var root = this.ownerShadyRootForNode(node)
        if (root) {
          root.update()
        }
      }
    },

  // NOTE: `query` is used primarily for ShadyDOM's querySelector impl,
  // but it's also generally useful to recurse through the element tree
  // and is used by Polymer's styling system.
    query: function query (node, matcher, halter) {
      var list = []
      this._queryElements(tree.Logical.getChildNodes(node), matcher,
      halter, list)
      return list
    },

    _queryElements: function _queryElements (elements, matcher, halter, list) {
      var this$1 = this

      for (var i = 0, l = elements.length, c; (i < l) && (c = elements[i]); i++) {
        if (c.nodeType === Node.ELEMENT_NODE &&
          this$1._queryElement(c, matcher, halter, list)) {
          return true
        }
      }
    },

    _queryElement: function _queryElement (node, matcher, halter, list) {
      var result = matcher(node)
      if (result) {
        list.push(node)
      }
      if (halter && halter(result)) {
        return result
      }
      this._queryElements(tree.Logical.getChildNodes(node), matcher,
      halter, list)
    },

    activeElementForNode: function activeElementForNode (node) {
      var this$1 = this

      var active = document.activeElement
      if (!active) {
        return null
      }
      var isShadyRoot$$1 = !!(isShadyRoot(node))
      if (node !== document) {
      // If this node isn't a document or shady root, then it doesn't have
      // an active element.
        if (!isShadyRoot$$1) {
          return null
        }
      // If this shady root's host is the active element or the active
      // element is not a descendant of the host (in the composed tree),
      // then it doesn't have an active element.
        if (node.host === active ||
          !node.host.contains(active)) {
          return null
        }
      }
    // This node is either the document or a shady root of which the active
    // element is a (composed) descendant of its host; iterate upwards to
    // find the active element's most shallow host within it.
      var activeRoot = this.ownerShadyRootForNode(active)
      while (activeRoot && activeRoot !== node) {
        active = activeRoot.host
        activeRoot = this$1.ownerShadyRootForNode(active)
      }
      if (node === document) {
      // This node is the document, so activeRoot should be null.
        return activeRoot ? null : active
      } else {
      // This node is a non-document shady root, and it should be
      // activeRoot.
        return activeRoot === node ? active : null
      }
    }

  }

  var nativeCloneNode = Element.prototype.cloneNode
  var nativeImportNode = Document.prototype.importNode
  var nativeSetAttribute$1 = Element.prototype.setAttribute
  var nativeRemoveAttribute = Element.prototype.removeAttribute

  var setAttribute = function (attr, value) {
  // avoid scoping elements in non-main document to avoid template documents
    if (window.ShadyCSS && attr === 'class' && this.ownerDocument === document) {
      window.ShadyCSS.setElementClass(this, value)
    } else {
      nativeSetAttribute$1.call(this, attr, value)
    }
  }

  var NodeMixin = {}

  Object.defineProperties(NodeMixin, {

    parentElement: {
      get: function get () {
        return tree.Logical.getParentNode(this)
      },
      configurable: true
    },

    parentNode: {
      get: function get$1 () {
        return tree.Logical.getParentNode(this)
      },
      configurable: true
    },

    nextSibling: {
      get: function get$2 () {
        return tree.Logical.getNextSibling(this)
      },
      configurable: true
    },

    previousSibling: {
      get: function get$3 () {
        return tree.Logical.getPreviousSibling(this)
      },
      configurable: true
    },

    nextElementSibling: {
      get: function get$4 () {
        return tree.Logical.getNextElementSibling(this)
      },
      configurable: true
    },

    previousElementSibling: {
      get: function get$5 () {
        return tree.Logical.getPreviousElementSibling(this)
      },
      configurable: true
    },

    assignedSlot: {
      get: function get$6 () {
        return this._assignedSlot
      },
      configurable: true
    }
  })

  var FragmentMixin = {

    appendChild: function appendChild (node) {
      return this.insertBefore(node)
    },

  // cases in which we may not be able to just do standard native call
  // 1. container has a shadyRoot (needsDistribution IFF the shadyRoot
  // has an insertion point)
  // 2. container is a shadyRoot (don't distribute, instead set
  // container to container.host.
  // 3. node is <content> (host of container needs distribution)
    insertBefore: function insertBefore (node, ref_node) {
      if (ref_node && tree.Logical.getParentNode(ref_node) !== this) {
        throw Error('The ref_node to be inserted before is not a child ' +
        'of this node')
      }
    // remove node from its current position iff it's in a tree.
      if (node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
        var parent = tree.Logical.getParentNode(node)
        mixinImpl.removeNodeFromParent(node, parent)
      }
      if (!mixinImpl.addNode(this, node, ref_node)) {
        if (ref_node) {
        // if ref_node is an insertion point replace with first distributed node
          var root = mixinImpl.ownerShadyRootForNode(ref_node)
          if (root) {
            ref_node = ref_node.localName === root.getInsertionPointTag() ?
            mixinImpl.firstComposedNode(ref_node) : ref_node
          }
        }
      // if adding to a shadyRoot, add to host instead
        var container = isShadyRoot(this) ?
        this.host : this
        if (ref_node) {
          tree.Composed.insertBefore(container, node, ref_node)
        } else {
          tree.Composed.appendChild(container, node)
        }
      }
      mixinImpl._scheduleObserver(this, node)
      return node
    },

  /**
    Removes the given `node` from the element's `lightChildren`.
    This method also performs dom composition.
  */
    removeChild: function removeChild (node) {
      if (tree.Logical.getParentNode(node) !== this) {
        throw Error('The node to be removed is not a child of this node: ' +
        node)
      }
      if (!mixinImpl.removeNode(node)) {
      // if removing from a shadyRoot, remove form host instead
        var container = isShadyRoot(this) ?
        this.host :
        this
      // not guaranteed to physically be in container; e.g.
      // undistributed nodes.
        var parent = tree.Composed.getParentNode(node)
        if (container === parent) {
          tree.Composed.removeChild(container, node)
        }
      }
      mixinImpl._scheduleObserver(this, null, node)
      return node
    },

    replaceChild: function replaceChild (node, ref_node) {
      this.insertBefore(node, ref_node)
      this.removeChild(ref_node)
      return node
    },

  // TODO(sorvell): consider doing native QSA and filtering results.
    querySelector: function querySelector (selector) {
    // match selector and halt on first result.
      var result = mixinImpl.query(this, function (n) {
        return matchesSelector(n, selector)
      }, function (n) {
        return Boolean(n)
      })[0]
      return result || null
    },

    querySelectorAll: function querySelectorAll (selector) {
      return mixinImpl.query(this, function (n) {
        return matchesSelector(n, selector)
      })
    },

    cloneNode: function cloneNode (deep) {
      if (this.localName == 'template') {
        return nativeCloneNode.call(this, deep)
      } else {
        var n = nativeCloneNode.call(this, false)
        if (deep) {
          var c$ = this.childNodes
          for (var i = 0, nc; i < c$.length; i++) {
            nc = c$[i].cloneNode(true)
            n.appendChild(nc)
          }
        }
        return n
      }
    },

    importNode: function importNode (externalNode, deep) {
    // for convenience use this node's ownerDoc if the node isn't a document
      var doc = this instanceof Document ? this :
      this.ownerDocument
      var n = nativeImportNode.call(doc, externalNode, false)
      if (deep) {
        var c$ = tree.Logical.getChildNodes(externalNode)
        common.patchNode(n)
        for (var i = 0, nc; i < c$.length; i++) {
          nc = doc.importNode(c$[i], true)
          n.appendChild(nc)
        }
      }
      return n
    }
  }

  Object.defineProperties(FragmentMixin, {

    childNodes: {
      get: function get$7 () {
        var c$ = tree.Logical.getChildNodes(this)
        return Array.isArray(c$) ? c$ : tree.arrayCopyChildNodes(this)
      },
      configurable: true
    },

    children: {
      get: function get$8 () {
        if (tree.Logical.hasChildNodes(this)) {
          return Array.prototype.filter.call(this.childNodes, function (n) {
            return (n.nodeType === Node.ELEMENT_NODE)
          })
        } else {
          return tree.arrayCopyChildren(this)
        }
      },
      configurable: true
    },

    firstChild: {
      get: function get$9 () {
        return tree.Logical.getFirstChild(this)
      },
      configurable: true
    },

    lastChild: {
      get: function get$10 () {
        return tree.Logical.getLastChild(this)
      },
      configurable: true
    },

    firstElementChild: {
      get: function get$11 () {
        return tree.Logical.getFirstElementChild(this)
      },
      configurable: true
    },

    lastElementChild: {
      get: function get$12 () {
        return tree.Logical.getLastElementChild(this)
      },
      configurable: true
    },

  // TODO(srovell): strictly speaking fragments do not have textContent
  // or innerHTML but ShadowRoots do and are not easily distinguishable.
  // textContent / innerHTML
    textContent: {
      get: function get$13 () {
        if (this.childNodes) {
          var tc = []
          for (var i = 0, cn = this.childNodes, c; (c = cn[i]); i++) {
            if (c.nodeType !== Node.COMMENT_NODE) {
              tc.push(c.textContent)
            }
          }
          return tc.join('')
        }
        return ''
      },
      set: function set (text) {
        mixinImpl.clearNode(this)
        if (text) {
          this.appendChild(document.createTextNode(text))
        }
      },
      configurable: true
    },

    innerHTML: {
      get: function get$14 () {
        return getInnerHTML(this)
      },
      set: function set$1 (text) {
        var this$1 = this

        mixinImpl.clearNode(this)
        var d = document.createElement('div')
        d.innerHTML = text
      // here, appendChild may move nodes async so we cannot rely
      // on node position when copying
        var c$ = tree.arrayCopyChildNodes(d)
        for (var i = 0; i < c$.length; i++) {
          this$1.appendChild(c$[i])
        }
      },
      configurable: true
    }

  })

  var ElementMixin = {

  // TODO(sorvell): should only exist on <slot>
    assignedNodes: function assignedNodes (options) {
      return (options && options.flatten ? this._distributedNodes :
      this._assignedNodes) || []
    },

    setAttribute: function setAttribute$1 (name, value) {
      setAttribute.call(this, name, value)
      mixinImpl.maybeDistributeAttributeChange(this, name)
    },

    removeAttribute: function removeAttribute (name) {
      nativeRemoveAttribute.call(this, name)
      mixinImpl.maybeDistributeAttributeChange(this, name)
    }

  }

  Object.defineProperties(ElementMixin, {

    shadowRoot: {
      get: function get$15 () {
        return this.shadyRoot
      }
    },

    slot: {
      get: function get$16 () {
        return this.getAttribute('slot')
      },
      set: function set$2 (value) {
        this.setAttribute('slot', value)
      }
    }

  })

  var activeElementDescriptor = {
    get: function get$17 () {
      return mixinImpl.activeElementForNode(this)
    }
  }

  var ActiveElementMixin = {}
  Object.defineProperties(ActiveElementMixin, {
    activeElement: activeElementDescriptor
  })

  var UnderActiveElementMixin = {}
  Object.defineProperties(UnderActiveElementMixin, {
    _activeElement: activeElementDescriptor
  })

  var Mixins = {

    Node: extendAll({__patched: 'Node'}, NodeMixin),

    Fragment: extendAll({__patched: 'Fragment'},
    NodeMixin, FragmentMixin, ActiveElementMixin),

    Element: extendAll({__patched: 'Element'},
    NodeMixin, FragmentMixin, ElementMixin, ActiveElementMixin),

  // Note: activeElement cannot be patched on document!
    Document: extendAll({__patched: 'Document'},
    NodeMixin, FragmentMixin, ElementMixin, UnderActiveElementMixin)

  }

  var getRootNode = function (node) {
    return mixinImpl.getRootNode(node)
  }

  function filterMutations (mutations, target) {
    var targetRootNode = getRootNode(target)
    return mutations.map(function (mutation) {
      var mutationInScope = (targetRootNode === getRootNode(mutation.target))
      if (mutationInScope && mutation.addedNodes) {
        var nodes = Array.from(mutation.addedNodes).filter(function (n) {
          return (targetRootNode === getRootNode(n))
        })
        if (nodes.length) {
          mutation = Object.create(mutation)
          Object.defineProperty(mutation, 'addedNodes', {
            value: nodes,
            configurable: true
          })
          return mutation
        }
      } else if (mutationInScope) {
        return mutation
      }
    }).filter(function (m) { return m })
  }

// const promise = Promise.resolve();

  var AsyncObserver = function AsyncObserver () {
    this._scheduled = false
    this.addedNodes = []
    this.removedNodes = []
    this.callbacks = new Set()
  }

  AsyncObserver.prototype.schedule = function schedule () {
    var this$1 = this

    if (!this._scheduled) {
      this._scheduled = true
      promish.then(function () {
        this$1.flush()
      })
    }
  }

  AsyncObserver.prototype.flush = function flush () {
    if (this._scheduled) {
      this._scheduled = false
      var mutations = this.takeRecords()
      if (mutations.length) {
        this.callbacks.forEach(function (cb) {
          cb(mutations)
        })
      }
    }
  }

  AsyncObserver.prototype.takeRecords = function takeRecords () {
    if (this.addedNodes.length || this.removedNodes.length) {
      var mutations = [{
        addedNodes: this.addedNodes,
        removedNodes: this.removedNodes
      }]
      this.addedNodes = []
      this.removedNodes = []
      return mutations
    }
    return []
  }

  var getComposedInnerHTML = function (node) {
    if (common.isNodePatched(node)) {
      return getInnerHTML(node, function (n) {
        return tree.Composed.getChildNodes(n)
      })
    } else {
      return node.innerHTML
    }
  }

  var getComposedChildNodes$1 = function (node) {
    return common.isNodePatched(node) ?
    tree.Composed.getChildNodes(node) :
    node.childNodes
  }

// TODO(sorvell): consider instead polyfilling MutationObserver
// directly so that users do not have to fork their code.
// Supporting the entire api may be challenging: e.g. filtering out
// removed nodes in the wrong scope and seeing non-distributing
// subtree child mutations.
  var observeChildren = function (node, callback) {
    common.patchNode(node)
    if (!node.__dom.observer) {
      node.__dom.observer = new AsyncObserver()
    }
    node.__dom.observer.callbacks.add(callback)
    var observer = node.__dom.observer
    return {
      _callback: callback,
      _observer: observer,
      _node: node,
      takeRecords: function takeRecords () {
        return observer.takeRecords()
      }
    }
  }

  var unobserveChildren = function (handle) {
    var observer = handle && handle._observer
    if (observer) {
      observer.callbacks.delete(handle._callback)
      if (!observer.callbacks.size) {
        handle._node.__dom.observer = null
      }
    }
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

/**
 * Patches elements that interacts with ShadyDOM
 * such that tree traversal and mutation apis act like they would under
 * ShadowDOM.
 *
 * This import enables seemless interaction with ShadyDOM powered
 * custom elements, enabling better interoperation with 3rd party code,
 * libraries, and frameworks that use DOM tree manipulation apis.
 */

  var patchedCount = 0

  var log = false

  var patchImpl = {

    canPatchNode: function (node) {
      switch (node) {
        case document.head:
        case document.documentElement:
          return false
        default:
          return true
      }
    },

    hasPrototypeDescriptors: Boolean(Object.getOwnPropertyDescriptor(
    window.Node.prototype, 'textContent')),

    patch: function (node) {
      patchedCount++
      log && window.console.warn('patch node', node)
      if (this.hasPrototypeDescriptors) {
        patchPrototype(node, this.mixinForObject(node))
      } else {
        window.console.warn('Patching instance rather than prototype', node)
        extend(node, this.mixinForObject(node))
      }
    },

    mixinForObject: function (obj) {
      switch (obj.nodeType) {
        case Node.ELEMENT_NODE:
          return Mixins.Element
        case Node.DOCUMENT_FRAGMENT_NODE:
          return Mixins.Fragment
        case Node.DOCUMENT_NODE:
          return Mixins.Document
        case Node.TEXT_NODE:
        case Node.COMMENT_NODE:
          return Mixins.Node
      }
    },

    unpatch: function (obj) {
      if (obj.__sourceProto) {
        obj.__proto__ = obj.__sourceProto
      }
    // TODO(sorvell): implement unpatching for non-proto patchable browsers
    }

  }

  function patchNode (node) {
    if (!settings.inUse) {
      return
    }
    if (!isNodePatched(node) && patchImpl.canPatchNode(node)) {
      tree.saveChildNodes(node)
      patchImpl.patch(node)
    }
  }

  function canUnpatchNode () {
    return Boolean(patchImpl.hasPrototypeDescriptors)
  }

  function unpatchNode (node) {
    patchImpl.unpatch(node)
  }

  function isNodePatched (node) {
    return Boolean(node.__patched)
  }

// TODO(sorvell): fake export
  common.patchNode = patchNode
  common.canUnpatchNode = canUnpatchNode
  common.isNodePatched = isNodePatched

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

  var origAddEventListener = Element.prototype.addEventListener
  var origRemoveEventListener = Element.prototype.removeEventListener

// https://github.com/w3c/webcomponents/issues/513#issuecomment-224183937
  var alwaysComposed = {
    blur: true,
    focus: true,
    focusin: true,
    focusout: true,
    click: true,
    dblclick: true,
    mousedown: true,
    mouseenter: true,
    mouseleave: true,
    mousemove: true,
    mouseout: true,
    mouseover: true,
    mouseup: true,
    wheel: true,
    beforeinput: true,
    input: true,
    keydown: true,
    keyup: true,
    compositionstart: true,
    compositionupdate: true,
    compositionend: true,
    touchstart: true,
    touchend: true,
    touchmove: true,
    touchcancel: true,
    pointerover: true,
    pointerenter: true,
    pointerdown: true,
    pointermove: true,
    pointerup: true,
    pointercancel: true,
    pointerout: true,
    pointerleave: true,
    gotpointercapture: true,
    lostpointercapture: true,
    dragstart: true,
    drag: true,
    dragenter: true,
    dragleave: true,
    dragover: true,
    drop: true,
    dragend: true,
    DOMActivate: true,
    DOMFocusIn: true,
    DOMFocusOut: true,
    keypress: true
  }

  function pathComposer (startNode, composed) {
    var composedPath = []
    var current = startNode
    var startRoot = startNode === window ? window : startNode.getRootNode()
    while (current) {
      composedPath.push(current)
      if (current.assignedSlot) {
        current = current.assignedSlot
      } else if (current.nodeType === Node.DOCUMENT_FRAGMENT_NODE && current.host && (composed || current !== startRoot)) {
        current = current.host
      } else {
        current = current.parentNode
      }
    }
  // event composedPath includes window when startNode's ownerRoot is document
    if (composedPath[composedPath.length - 1] === document) {
      composedPath.push(window)
    }
    return composedPath
  }

  function retarget (refNode, path) {
    if (!isShadyRoot) {
      return refNode
    }
  // If ANCESTOR's root is not a shadow root or ANCESTOR's root is BASE's
  // shadow-including inclusive ancestor, return ANCESTOR.
    var refNodePath = pathComposer(refNode, true)
    var p$ = path
    for (var i = 0, ancestor, lastRoot, root, rootIdx; i < p$.length; i++) {
      ancestor = p$[i]
      root = ancestor === window ? window : ancestor.getRootNode()
      if (root !== lastRoot) {
        rootIdx = refNodePath.indexOf(root)
        lastRoot = root
      }
      if (!isShadyRoot(root) || rootIdx > -1) {
        return ancestor
      }
    }
  }

  var EventMixin = {

    __patched: 'Event',

    get composed () {
      if (this.isTrusted && this.__composed === undefined) {
        this.__composed = alwaysComposed[this.type]
      }
      return this.__composed || false
    },

    composedPath: function composedPath () {
      if (!this.__composedPath) {
        this.__composedPath = pathComposer(this.__target, this.composed)
      }
      return this.__composedPath
    },

    get target () {
      return retarget(this.currentTarget, this.composedPath())
    },

  // http://w3c.github.io/webcomponents/spec/shadow/#event-relatedtarget-retargeting
    get relatedTarget () {
      if (!this.__relatedTarget) {
        return null
      }
      if (!this.__relatedTargetComposedPath) {
        this.__relatedTargetComposedPath = pathComposer(this.__relatedTarget, true)
      }
    // find the deepest node in relatedTarget composed path that is in the same root with the currentTarget
      return retarget(this.currentTarget, this.__relatedTargetComposedPath)
    },
    stopPropagation: function stopPropagation () {
      Event.prototype.stopPropagation.call(this)
      this.__propagationStopped = true
    },
    stopImmediatePropagation: function stopImmediatePropagation () {
      Event.prototype.stopImmediatePropagation.call(this)
      this.__immediatePropagationStopped = true
      this.__propagationStopped = true
    }

  }

  function mixinComposedFlag (Base) {
  // NOTE: avoiding use of `class` here so that transpiled output does not
  // try to do `Base.call` with a dom construtor.
    var klazz = function (type, options) {
      var event = new Base(type, options)
      event.__composed = options && Boolean(options.composed)
      return event
    }
  // put constructor properties on subclass
    mixin(klazz, Base)
    klazz.prototype = Base.prototype
    return klazz
  }

  var nonBubblingEventsToRetarget = {
    focus: true,
    blur: true
  }

  function fireHandlers (event, node, phase) {
    var hs = node.__handlers && node.__handlers[event.type] &&
    node.__handlers[event.type][phase]
    if (hs) {
      for (var i = 0, fn; (fn = hs[i]); i++) {
        fn.call(node, event)
        if (event.__immediatePropagationStopped) {
          return
        }
      }
    }
  }

  function retargetNonBubblingEvent (e) {
    var path = e.composedPath()
    var node
  // override `currentTarget` to let patched `target` calculate correctly
    Object.defineProperty(e, 'currentTarget', {
      get: function () {
        return node
      },
      configurable: true
    })
    for (var i = path.length - 1; i >= 0; i--) {
      node = path[i]
    // capture phase fires all capture handlers
      fireHandlers(e, node, 'capture')
      if (e.__propagationStopped) {
        return
      }
    }

  // set the event phase to `AT_TARGET` as in spec
    Object.defineProperty(e, 'eventPhase', {value: Event.AT_TARGET})

  // the event only needs to be fired when owner roots change when iterating the event path
  // keep track of the last seen owner root
    var lastFiredRoot
    for (var i$1 = 0; i$1 < path.length; i$1++) {
      node = path[i$1]
      if (i$1 === 0 || (node.shadowRoot && node.shadowRoot === lastFiredRoot)) {
        fireHandlers(e, node, 'bubble')
      // don't bother with window, it doesn't have `getRootNode` and will be last in the path anyway
        if (node !== window) {
          lastFiredRoot = node.getRootNode()
        }
        if (e.__propagationStopped) {
          return
        }
      }
    }
  }

  function addEventListener (type, fn, optionsOrCapture) {
    var this$1 = this

    if (!fn) {
      return
    }

  // The callback `fn` might be used for multiple nodes/events. Since we generate
  // a wrapper function, we need to keep track of it when we remove the listener.
  // It's more efficient to store the node/type/options information as Array in
  // `fn` itself rather than the node (we assume that the same callback is used
  // for few nodes at most, whereas a node will likely have many event listeners).
  // NOTE(valdrin) invoking external functions is costly, inline has better perf.
    var capture, once, passive
    if (typeof optionsOrCapture === 'object') {
      capture = Boolean(optionsOrCapture.capture)
      once = Boolean(optionsOrCapture.once)
      passive = Boolean(optionsOrCapture.passive)
    } else {
      capture = Boolean(optionsOrCapture)
      once = false
      passive = false
    }
    if (fn.__eventWrappers) {
    // Stop if the wrapper function has already been created.
      for (var i = 0; i < fn.__eventWrappers.length; i++) {
        if (fn.__eventWrappers[i].node === this$1 &&
          fn.__eventWrappers[i].type === type &&
          fn.__eventWrappers[i].capture === capture &&
          fn.__eventWrappers[i].once === once &&
          fn.__eventWrappers[i].passive === passive) {
          return
        }
      }
    } else {
      fn.__eventWrappers = []
    }

    var wrapperFn = function (e) {
    // Support `once` option.
      if (once) {
        this.removeEventListener(type, fn, optionsOrCapture)
      }
      if (!e.__target) {
        e.__target = e.target
        e.__relatedTarget = e.relatedTarget
        patchPrototype(e, EventMixin)
      }
    // There are two critera that should stop events from firing on this node
    // 1. the event is not composed and the current node is not in the same root as the target
    // 2. when bubbling, if after retargeting, relatedTarget and target point to the same node
      if (e.composed || e.composedPath().indexOf(this) > -1) {
        if (e.eventPhase === Event.BUBBLING_PHASE) {
          if (e.target === e.relatedTarget) {
            e.stopImmediatePropagation()
            return
          }
        }
        return fn(e)
      }
    }
  // Store the wrapper information.
    fn.__eventWrappers.push({
      node: this,
      type: type,
      capture: capture,
      once: once,
      passive: passive,
      wrapperFn: wrapperFn
    })

    if (nonBubblingEventsToRetarget[type]) {
      this.__handlers = this.__handlers || {}
      this.__handlers[type] = this.__handlers[type] || {capture: [], bubble: []}
      this.__handlers[type][capture ? 'capture' : 'bubble'].push(wrapperFn)
    } else {
      origAddEventListener.call(this, type, wrapperFn, optionsOrCapture)
    }
  }

  function removeEventListener (type, fn, optionsOrCapture) {
    var this$1 = this

    if (!fn) {
      return
    }

  // NOTE(valdrin) invoking external functions is costly, inline has better perf.
    var capture, once, passive
    if (typeof optionsOrCapture === 'object') {
      capture = Boolean(optionsOrCapture.capture)
      once = Boolean(optionsOrCapture.once)
      passive = Boolean(optionsOrCapture.passive)
    } else {
      capture = Boolean(optionsOrCapture)
      once = false
      passive = false
    }
  // Search the wrapped function.
    var wrapperFn
    if (fn.__eventWrappers) {
      for (var i = 0; i < fn.__eventWrappers.length; i++) {
        if (fn.__eventWrappers[i].node === this$1 &&
          fn.__eventWrappers[i].type === type &&
          fn.__eventWrappers[i].capture === capture &&
          fn.__eventWrappers[i].once === once &&
          fn.__eventWrappers[i].passive === passive) {
          wrapperFn = fn.__eventWrappers.splice(i, 1)[0].wrapperFn
        // Cleanup.
          if (!fn.__eventWrappers.length) {
            fn.__eventWrappers = undefined
          }
          break
        }
      }
    }

    origRemoveEventListener.call(this, type, wrapperFn || fn, optionsOrCapture)
    if (wrapperFn && nonBubblingEventsToRetarget[type] &&
      this.__handlers && this.__handlers[type]) {
      var arr = this.__handlers[type][capture ? 'capture' : 'bubble']
      var idx = arr.indexOf(wrapperFn)
      if (idx > -1) {
        arr.splice(idx, 1)
      }
    }
  }

  function activateFocusEventOverrides () {
    for (var ev in nonBubblingEventsToRetarget) {
      window.addEventListener(ev, function (e) {
        if (!e.__target) {
          e.__target = e.target
          e.__relatedTarget = e.relatedTarget
          patchPrototype(e, EventMixin)
          retargetNonBubblingEvent(e)
          e.stopImmediatePropagation()
        }
      }, true)
    }
  }

  var PatchedEvent = mixinComposedFlag(Event)
  var PatchedCustomEvent = mixinComposedFlag(CustomEvent)
  var PatchedMouseEvent = mixinComposedFlag(MouseEvent)

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
 * Patches elements that interacts with ShadyDOM
 * such that tree traversal and mutation apis act like they would under
 * ShadowDOM.
 *
 * This import enables seemless interaction with ShadyDOM powered
 * custom elements, enabling better interoperation with 3rd party code,
 * libraries, and frameworks that use DOM tree manipulation apis.
 */

  if (settings.inUse) {
    window.ShadyDOM = {
      tree: tree,
      getNativeProperty: getNativeProperty,
      patch: patchNode,
      isPatched: isNodePatched,
      getComposedInnerHTML: getComposedInnerHTML,
      getComposedChildNodes: getComposedChildNodes$1,
      unpatch: unpatchNode,
      canUnpatch: canUnpatchNode,
      isShadyRoot: isShadyRoot,
      enqueue: enqueue,
      flush: flush$1,
      inUse: settings.inUse,
      filterMutations: filterMutations,
      observeChildren: observeChildren,
      unobserveChildren: unobserveChildren
    }

    var createRootAndEnsurePatched = function (node) {
    // TODO(sorvell): need to ensure ancestors are patched but this introduces
    // a timing problem with gathering composed children.
    // (1) currently the child list is crawled and patched when patching occurs
    // (this needs to change)
    // (2) we can only patch when an element has received its parsed children
    // because we cannot detect them when inserted by parser.
    // let ancestor = node;
    // while (ancestor) {
    //   patchNode(ancestor);
    //   ancestor = ancestor.parentNode || ancestor.host;
    // }
      patchNode(node)
      var root = new ShadyRoot(node)
      patchNode(root)
      return root
    }

    Element.prototype.attachShadow = function () {
      return createRootAndEnsurePatched(this)
    }

    Node.prototype.addEventListener = addEventListener
    Node.prototype.removeEventListener = removeEventListener
    Event = PatchedEvent
    CustomEvent = PatchedCustomEvent
    MouseEvent = PatchedMouseEvent
    activateFocusEventOverrides()

    Object.defineProperty(Node.prototype, 'isConnected', {
      get: function get () {
        return document.documentElement.contains(this)
      },
      configurable: true
    })

    Node.prototype.getRootNode = function (options) {
      return getRootNode(this, options)
    }

    Object.defineProperty(Element.prototype, 'slot', {
      get: function get$1 () {
        return this.getAttribute('slot')
      },
      set: function set (value) {
        this.setAttribute('slot', value)
      },
      configurable: true
    })

    Object.defineProperty(Node.prototype, 'assignedSlot', {
      get: function get$2 () {
        return this._assignedSlot || null
      },
      configurable: true
    })

    var nativeSetAttribute = Element.prototype.setAttribute
    Element.prototype.setAttribute = setAttribute
  // NOTE: expose native setAttribute to allow hooking native method
  // (e.g. this is done in ShadyCSS)
    Element.prototype.__nativeSetAttribute = nativeSetAttribute

    var classNameDescriptor = {
      get: function get$3 () {
        return this.getAttribute('class')
      },
      set: function set$1 (value) {
        this.setAttribute('class', value)
      },
      configurable: true
    }

  // Safari 9 `className` is not configurable
    var cn = Object.getOwnPropertyDescriptor(Element.prototype, 'className')
    if (cn && cn.configurable) {
      Object.defineProperty(Element.prototype, 'className', classNameDescriptor)
    } else {
    // on IE `className` is on Element
      var h = window.customElements && window.customElements.nativeHTMLElement ||
      HTMLElement
      cn = Object.getOwnPropertyDescriptor(h.prototype, 'className')
      if (cn && cn.configurable) {
        Object.defineProperty(h.prototype, 'className', classNameDescriptor)
      }
    }
  }
}())
