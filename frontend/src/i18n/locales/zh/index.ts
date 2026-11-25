import type enDict from '../en'
import common from './common'
import app from './app'
import tree from './tree'
import settings from './settings'
import dialogs from './dialogs'
import viewers from './viewers'
import officeViewers from './officeViewers'
import update from './update'
import errors from './errors'

const zh: Record<keyof typeof enDict, string> = {
  ...common,
  ...app,
  ...tree,
  ...settings,
  ...dialogs,
  ...viewers,
  ...officeViewers,
  ...update,
  ...errors,
}

export default zh
