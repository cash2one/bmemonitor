
function copy(one) {
  if ('object' !== typeof one) return one
  var two = {}
  for (var name in one) {
    two[name] = one[name]
  }
  return two
}

module.exports = {
  collapse: {
    args: ['id', 'doCollapse'],
    apply: function (view, model) {
      model.setCollapsed(this.id, this.doCollapse)
      view.setCollapsed(this.id, this.doCollapse)
      view.goTo(this.id)
    },
    undo: function (view, model) {
      model.setCollapsed(this.id, !this.doCollapse)
      view.setCollapsed(this.id, !this.doCollapse)
      view.goTo(this.id)
    },
  },
  newNode: {
    args: ['pid', 'index', 'text'],
    apply: function (view, model) {
      var cr = model.create(this.pid, this.index, this.text)
      this.id = cr.node.id
      view.add(cr.node, cr.before)
      // view.startEditing(cr.node.id)
    },
    undo: function (view, model) {
      var ed = view.editing
      view.remove(this.id)
      this.saved = model.remove(this.id)
      var nid = model.ids[this.pid].children[this.index-1]
      if (nid === undefined) nid = this.pid
      if (ed) {
        view.startEditing(nid)
      } else {
        view.setActive(nid)
      }
    },
    redo: function (view, model) {
      var before = model.readd(this.saved)
      view.add(this.saved.node, before)
    }
  },
  appendText: {
    args: ['id', 'text'],
    apply: function (view, model) {
      this.oldtext = model.ids[this.id].data.name
      model.appendText(this.id, this.text)
      view.appendText(this.id, this.text)
    },
    undo: function (view, model) {
      model.setAttr(this.id, 'name', this.oldtext)
      view.setAttr(this.id, 'name', this.oldtext)
    }
  },
  changeNodeAttr: {
    args: ['id', 'attr', 'value'],
    apply: function (view, model) {
      this.oldvalue = copy(model.ids[this.id].data[this.attr])
      model.setAttr(this.id, this.attr, this.value)
      view.setAttr(this.id, this.attr, this.value)
      view.goTo(this.id)
    },
    undo: function (view, model) {
      model.setAttr(this.id, this.attr, this.oldvalue)
      view.setAttr(this.id, this.attr, this.oldvalue)
      view.goTo(this.id)
    }
  },
  changeNode: {
    args: ['id', 'newdata'],
    apply: function (view, model) {
      this.olddata = copy(model.ids[this.id].data)
      model.setData(this.id, this.newdata)
      view.setData(this.id, this.newdata)
      view.goTo(this.id)
    },
    undo: function (view, model) {
      model.setData(this.id, this.olddata)
      view.setData(this.id, this.olddata)
      view.goTo(this.id)
    }
  },
  remove: {
    args: ['id'],
    apply: function (view, model) {
      var below = model.nextSibling(this.id)
      if (undefined === below) below = model.idAbove(this.id)
      view.remove(this.id)
      this.saved = model.remove(this.id)
      view.startEditing(below)
    },
    undo: function (view, model) {
      var before = model.readd(this.saved)
      view.addTree(this.saved.node, before)
    }
  },
  copy: {
    args: ['ids'],
    apply: function (view, model) {
      var items = this.ids.map(function (id) {
        return model.dumpData(id, true)
      })
      model.clipboard = items
    },
    undo: function (view, model) {
    }
  },
  cut: {
    args: ['ids'],
    apply: function (view, model) {
      var items = this.ids.map(function (id) {
        view.remove(id)
        return model.dumpData(id, true)
      })
      model.clipboard = items

      var id = this.ids[this.ids.length-1]
      var below = model.nextSibling(id)
      if (undefined === below) below = model.idAbove(this.ids[0])
      this.saved = this.ids.map(function (id) {
        return model.remove(id)
      })

      if (view.editing) {
        view.startEditing(below)
      } else {
        view.setActive(below)
      }
    },
    undo: function (view, model) {
      var before
      for (var i=this.saved.length-1; i>=0; i--) {
        before = model.readd(this.saved[i])
        view.addTree(this.saved[i].node, before)
      }
      if (this.ids.length > 1) {
        view.setSelection(this.ids)
        view.setActive(this.ids[this.ids.length-1])
      }
    }
  },
  paste: {
    args: ['pid', 'index'],
    apply: function (view, model) {
      var pid = this.pid
        , index = this.index
        , ed = view.editing
      var ids = model.clipboard.map(function (item) {
        var cr = model.createNodes(pid, index, item)
        view.addTree(cr.node, cr.before)
        view.setCollapsed(cr.node.parent, false)
        model.setCollapsed(cr.node.parent, false)
        index += 1
        return cr.node.id
      })
      this.newids = ids
      if (ids.length == 1) {
        if (ed) {
          view.startEditing(this.newids[0])
        } else {
          view.setActive(this.newids[0])
        }
      } else {
        view.setSelection(ids)
        view.setActive(ids[ids.length-1])
      }
    },
    undo: function (view, model) {
      var id = this.newids[this.newids.length-1]
      var below = model.nextSibling(id)
      if (undefined === below) below = model.idAbove(this.newids[0])
      this.saved = this.newids.map(function (id) {
        view.remove(id)
        return model.remove(id)
      })
      if (view.editing) {
        view.startEditing(below)
      } else {
        view.setActive(below)
      }
      // view.remove(this.newid)
      // this.saved = model.remove(this.newid)
      model.clipboard = this.saved
    },
    redo: function (view, model) {
      // var before = model.readd(this.saved)
      // view.addTree(this.saved.node, before)
      this.saved.map(function (item) {
        var before = model.readd(item)
        view.addTree(item.node, before)
      })
    }
  },
  move: {
    args: ['id', 'pid', 'index'],
    apply: function (view, model) {
      this.opid = model.ids[this.id].parent
      this.oindex = model.ids[this.opid].children.indexOf(this.id)
      var before = model.move(this.id, this.pid, this.index)
      var parent = model.ids[this.opid]
        , lastchild = parent.children.length === 0
      view.move(this.id, this.pid, before, this.opid, lastchild)
      view.goTo(this.id)
    },
    undo: function (view, model) {
      var before = model.move(this.id, this.opid, this.oindex)
        , lastchild = model.ids[this.pid].children.length === 0
      view.move(this.id, this.opid, before, this.pid, lastchild)
      view.goTo(this.id)
    }
  }
}

