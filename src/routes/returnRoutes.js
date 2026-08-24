import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { createReturnRequest, getMyReturns, getReturnById } from '../controllers/returnController.js'

const router = express.Router()

router.use(protect)

router.post('/', createReturnRequest)
router.get('/my', getMyReturns)
router.get('/:id', getReturnById)

export default router
