/**
 * Express Application Setup (TypeScript)
 */

import express, { Express } from 'express';
import cors from 'cors';
import userRoutes from './routes/user.routes';
import appConstantRoutes from './routes/appconstant.routes';
import inventoryRoutes from './routes/inventory.routes';
import adSalesAdSpendRoutes from './routes/adsalesadspend.routes';
import orderRoutes from './routes/order.routes';
import pnlRoutes from './routes/pnl.routes';
import salesanalysisRoutes from './routes/salesanalysis.routes';

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/user', userRoutes);
app.use('/api/appconstant', appConstantRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/adsalesadspend', adSalesAdSpendRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/pnl', pnlRoutes);
app.use('/api/:databaseName/salesanalysis', salesanalysisRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

export default app;

