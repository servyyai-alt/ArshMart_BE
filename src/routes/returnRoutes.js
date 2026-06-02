import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { createReturnRequest, getMyReturns, getReturnById, trackMyReturn } from '../controllers/returnController.js'

const router = express.Router()

router.use(protect)

router.post('/', createReturnRequest)
router.get('/my', getMyReturns)
router.get('/:id', getReturnById)
router.get('/:id/track', trackMyReturn)

export default router

