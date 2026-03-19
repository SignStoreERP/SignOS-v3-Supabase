import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================================
// 1. SUPABASE INITIALIZATION (SERVICE ROLE)
// ==========================================
// WARNING: This uses the Service Role key to bypass RLS for fetching private cost matrices.
// NEVER expose this key on the frontend.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// 2. CORS & MIDDLEWARE CONFIGURATION
// ==========================================
// Restrict origin to your Vercel frontend in production
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*', // e.g., 'https://signos-v4.vercel.app'
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increased limit for complex vector payloads

// ==========================================
// 3. AUTHENTICATION MIDDLEWARE (PROTOCOL 6550)
// ==========================================
const requireSupabaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Check for Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Verify the token using Supabase Auth
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('Auth Error:', error?.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    // Optional: Check if user is an active employee based on metadata or a specific table
    // if (user.user_metadata.role !== 'employee') return res.status(403).json({ error: 'Forbidden' });

    // Attach user to request for downstream logging/processing
    req.user = user;
    next();
  } catch (err) {
    console.error('Middleware Error:', err);
    res.status(500).json({ error: 'Internal Server Error during authentication' });
  }
};

// ==========================================
// 4. THE PROXY ROUTE (ZERO CLIENT-SIDE MATH)
// ==========================================
app.post('/api/process-cartridge', requireSupabaseAuth, async (req, res) => {
  try {
    const signConfig = req.body;
    
    if (!signConfig || !signConfig.type) {
      return res.status(400).json({ error: 'Invalid SignConfig payload' });
    }

    console.log(`[${new Date().toISOString()}] Processing job for user: ${req.user.id}`);

    // A. Securely fetch private material cost matrices using Service Role
    const [variablesRes, curvesRes] = await Promise.all([
      supabaseAdmin.from('global_variables').select('*'),
      supabaseAdmin.from('retail_curves').select('*')
    ]);

    if (variablesRes.error) throw new Error(`Failed to fetch global_variables: ${variablesRes.error.message}`);
    if (curvesRes.error) throw new Error(`Failed to fetch retail_curves: ${curvesRes.error.message}`);

    const globalVariables = variablesRes.data;
    const retailCurves = curvesRes.data;

    // B. TODO: Drop in existing vector/pricing logic here
    // Example:
    // const { area, perimeter, svgPaths } = VectorEngine.process(signConfig);
    // const { retailPrice, costBreakdown } = PricingEngine.calculate(signConfig, globalVariables, retailCurves, area, perimeter);

    // --- MOCK DATA FOR BOILERPLATE ---
    const mockSvgPaths = {
      routerFace: '<svg xmlns="http://www.w3.org/2000/svg">...</svg>',
      routerBack: '<svg xmlns="http://www.w3.org/2000/svg">...</svg>',
      benderPath: '<svg xmlns="http://www.w3.org/2000/svg">...</svg>'
    };
    
    const mockCostBreakdown = [
      { category: 'Materials', cost: 145.50 },
      { category: 'Labor', cost: 210.00 },
      { category: 'Overhead', cost: 50.00 }
    ];

    const mockRetailPrice = 850.00;
    // ---------------------------------

    // C. Return the final payload
    return res.json({
      success: true,
      data: {
        retailPrice: mockRetailPrice,
        costBreakdown: mockCostBreakdown,
        svgPaths: mockSvgPaths
      }
    });

  } catch (error) {
    console.error('Processing Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process SignConfig cartridge', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'SignOS VPS Proxy' });
});

app.listen(PORT, () => {
  console.log(`SignOS VPS Factory Proxy running on port ${PORT}`);
});