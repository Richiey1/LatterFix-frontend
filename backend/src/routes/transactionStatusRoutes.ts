import { Request, Response, Router } from 'express';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: TransactionStatus
 *   description: Transaction status polling for real-time updates fallback
 */

// Apply authentication to all transaction status routes
router.use(authenticateJWT);

/**
 * @swagger
 * /api/transactions/status/batch:
 *   post:
 *     summary: Batch poll transaction status
 *     tags: [TransactionStatus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   transactionId:
 *                     type: string
 *                   status:
 *                     type: string
 *                   confirmations:
 *                     type: integer
 *                   hash:
 *                     type: string
 *                   timestamp:
 *                     type: string
 */
router.post('/status/batch', async (req: Request, res: Response) => {
  try {
    const { transactionIds } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.json([]);
    }

    // Query transaction status from database
    const placeholders = transactionIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT 
        tx_hash as "transactionId",
        status,
        1 as confirmations,
        tx_hash as hash,
        created_at as timestamp,
        amount,
        asset_code
      FROM transactions 
      WHERE tx_hash IN (${placeholders})
      UNION
      SELECT 
        batch_id as "transactionId",
        status,
        0 as confirmations,
        NULL as hash,
        created_at as timestamp,
        total_amount as amount,
        asset_code
      FROM payroll_runs 
      WHERE batch_id IN (${placeholders})
    `;

    const result = await pool.query(query, [...transactionIds, ...transactionIds]);

    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to batch poll transaction status:', error);
    res.status(500).json({ error: 'Failed to poll transaction status' });
  }
});

/**
 * @swagger
 * /api/transactions/{transactionId}/status:
 *   get:
 *     summary: Get single transaction status
 *     tags: [TransactionStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:transactionId/status', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    // Query transaction status from database
    const txQuery = `
      SELECT 
        tx_hash as "transactionId",
        status,
        1 as confirmations,
        tx_hash as hash,
        created_at as timestamp,
        amount,
        asset_code
      FROM transactions 
      WHERE tx_hash = $1
    `;

    const txResult = await pool.query(txQuery, [transactionId]);

    if (txResult.rows.length > 0) {
      return res.json(txResult.rows[0]);
    }

    // Check payroll runs if not found in transactions
    const payrollQuery = `
      SELECT 
        batch_id as "transactionId",
        status,
        0 as confirmations,
        NULL as hash,
        created_at as timestamp,
        total_amount as amount,
        asset_code
      FROM payroll_runs 
      WHERE batch_id = $1
    `;

    const payrollResult = await pool.query(payrollQuery, [transactionId]);

    if (payrollResult.rows.length > 0) {
      return res.json(payrollResult.rows[0]);
    }

    // Transaction not found
    res.status(404).json({
      transactionId,
      status: 'unknown',
      confirmations: 0,
      timestamp: new Date().toISOString(),
      message: 'Transaction not found',
    });
  } catch (error) {
    logger.error('Failed to get transaction status:', error);
    res.status(500).json({ error: 'Failed to get transaction status' });
  }
});

/**
 * @swagger
 * /api/transactions/{transactionId}/milestones:
 *   get:
 *     summary: Get transaction milestones
 *     tags: [TransactionStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:transactionId/milestones', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    // Return mock milestones for now
    // In production, this would query from a milestones table
    const milestones = [
      {
        id: `${transactionId}-1`,
        type: 'payment_initiated',
        transactionId,
        timestamp: new Date().toISOString(),
      },
    ];

    res.json(milestones);
  } catch (error) {
    logger.error('Failed to get transaction milestones:', error);
    res.status(500).json({ error: 'Failed to get transaction milestones' });
  }
});

export default router;
