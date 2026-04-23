import { Router } from 'express'
import { analyze } from '../controllers/analyzeController.js'
import { checkin } from '../controllers/checkinController.js'
import { history } from '../controllers/historyController.js'
import { insights } from '../controllers/insightsController.js'
import { feedback } from '../controllers/feedbackController.js'
import { debugAnalyze } from '../controllers/debugController.js'

const router = Router()

router.post('/analyze', analyze)
router.post('/checkin', checkin)
router.get('/history', history)
router.get('/insights', insights)
router.post('/feedback', feedback)
router.post('/debug', debugAnalyze)
router.get('/debug', debugAnalyze)

export default router
