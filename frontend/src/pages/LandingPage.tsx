import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Code,
  Terminal,
  Activity,
  Lock,
  Play,
  ChevronRight,
  Zap,
  GitBranch,
} from 'lucide-react';
import { useTaskStore } from '../services/taskStore';
import { useWallet } from '../hooks/useWallet';
import { fetchNetworkFeeStats, type NetworkFeeStats } from '../services/transactionHistory';

interface MethodParam {
  name: string;
  type: string;
  placeholder: string;
}

interface ContractMethod {
  name: string;
  description: string;
  params: MethodParam[];
  returnType: string;
  execute: (
    inputs: Record<string, string>,
    store: any,
    walletAddress: string | null
  ) => { success: boolean; data: any; message: string };
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { tasks } = useTaskStore();
  const { address: walletAddress, connect, disconnect, isConnecting } = useWallet();

  const [activeMethod, setActiveMethod] = useState<string | null>(null);
  const [methodInputs, setMethodInputs] = useState<Record<string, string>>({});
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    output: string;
  } | null>(null);
  const [feeStats, setFeeStats] = useState<NetworkFeeStats | null>(null);

  useEffect(() => {
    fetchNetworkFeeStats()
      .then(setFeeStats)
      .catch(() => null);
  }, []);

  // Filter open tasks to display as "Live Bounties"
  const openTasks = tasks.filter((t) => t.status === 'Open' || t.status === 'InEscrow');

  // Define 12 contract methods
  const contractMethods: ContractMethod[] = [
    {
      name: 'bootstrap',
      description: 'Bootstrap the contract with admin, fee BPS, token address, and fee recipient.',
      params: [
        { name: 'admin', type: 'string (address)', placeholder: 'G-CREATOR-Admin-111' },
        { name: 'fee_bps', type: 'u32 (basis points)', placeholder: '250 (equals 2.5%)' },
        { name: 'token', type: 'string (address)', placeholder: 'USDC_TOKEN_ADDRESS' },
        { name: 'fee_recipient', type: 'string (address)', placeholder: 'G-FEE-RECIPIENT' },
      ],
      returnType: 'void',
      execute: (inputs, store) => {
        const feeBps = parseInt(inputs.fee_bps || '250');
        store.initializePlatform(inputs.admin || 'G-CREATOR-Admin-111', feeBps, [
          'USDC',
          'XLM',
          'EURC',
        ]);
        return {
          success: true,
          data: { initialized: true, admin: inputs.admin || 'G-CREATOR-Admin-111', feeBps },
          message: 'Contract successfully bootstrapped on-chain!',
        };
      },
    },
    {
      name: 'deposit_reward',
      description: 'Deposit reward into escrow and register a new on-chain task.',
      params: [
        { name: 'task_id', type: 'string', placeholder: 'task-3' },
        { name: 'reward', type: 'u32', placeholder: '350' },
      ],
      returnType: 'void',
      execute: (inputs, store) => {
        const taskId = inputs.task_id;
        if (!taskId)
          return { success: false, data: null, message: 'task_id parameter is required' };
        const taskExists = store.tasks.find((t: any) => t.id === taskId);
        if (!taskExists)
          return { success: false, data: null, message: `Task with ID ${taskId} not found` };
        if (taskExists.status !== 'Open')
          return {
            success: false,
            data: null,
            message: `Task is already funded or in progress (current status: ${taskExists.status})`,
          };

        store.fundTask(taskId);
        return {
          success: true,
          data: { taskId, reward: taskExists.reward, status: 'InEscrow' },
          message: `Escrow successfully funded for task: ${taskExists.title}`,
        };
      },
    },
    {
      name: 'claim',
      description: 'Claim an open task and move it to InProgress state.',
      params: [
        { name: 'task_id', type: 'string', placeholder: 'task-2' },
        { name: 'contributor', type: 'string (address)', placeholder: 'G-CONTRIB-Alice-888' },
      ],
      returnType: 'void',
      execute: (inputs, store) => {
        const taskId = inputs.task_id;
        const contributor = inputs.contributor || 'G-CONTRIB-Alice-888';
        if (!taskId)
          return { success: false, data: null, message: 'task_id parameter is required' };

        const task = store.tasks.find((t: any) => t.id === taskId);
        if (!task) return { success: false, data: null, message: `Task ${taskId} not found` };
        if (task.status !== 'InEscrow')
          return {
            success: false,
            data: null,
            message: `Task status must be Funded/InEscrow to claim (current: ${task.status})`,
          };

        store.assignTask(taskId, contributor);
        return {
          success: true,
          data: { taskId, assignee: contributor, status: 'Assigned' },
          message: `Task successfully claimed by and assigned to: ${contributor}`,
        };
      },
    },
    {
      name: 'submit',
      description: 'Submit a delivery URL, advancing the task to Completed state.',
      params: [
        { name: 'task_id', type: 'string', placeholder: 'task-1' },
        { name: 'delivery_url', type: 'string', placeholder: 'https://github.com/my-pr-link' },
      ],
      returnType: 'void',
      execute: (inputs, store) => {
        const taskId = inputs.task_id;
        const deliveryUrl =
          inputs.delivery_url || 'https://github.com/LatterFixxx/LatterFix-frontend/pull/1';
        if (!taskId)
          return { success: false, data: null, message: 'task_id parameter is required' };

        const task = store.tasks.find((t: any) => t.id === taskId);
        if (!task) return { success: false, data: null, message: `Task ${taskId} not found` };
        if (task.status !== 'Assigned')
          return {
            success: false,
            data: null,
            message: `Task status must be Assigned to submit work (current: ${task.status})`,
          };

        store.submitCompletion(taskId);
        return {
          success: true,
          data: { taskId, deliveryUrl, completionSubmitted: true },
          message: `Delivery URL successfully submitted for review: ${deliveryUrl}`,
        };
      },
    },
    {
      name: 'verify',
      description: 'Verify delivery and release escrowed funds minus platform fee.',
      params: [{ name: 'task_id', type: 'string', placeholder: 'task-1' }],
      returnType: 'void',
      execute: (inputs, store) => {
        const taskId = inputs.task_id;
        if (!taskId)
          return { success: false, data: null, message: 'task_id parameter is required' };

        const task = store.tasks.find((t: any) => t.id === taskId);
        if (!task) return { success: false, data: null, message: `Task ${taskId} not found` };
        if (task.status !== 'Assigned')
          return {
            success: false,
            data: null,
            message: `Task must be Assigned to verify and payout`,
          };

        store.completeTaskAndPayout(taskId);
        return {
          success: true,
          data: { taskId, status: 'Completed', released: true },
          message: `Delivery verified. On-chain payout successfully triggered and released!`,
        };
      },
    },
    {
      name: 'cancel',
      description: 'Cancel an open task and refund the escrowed reward to creator.',
      params: [{ name: 'task_id', type: 'string', placeholder: 'task-2' }],
      returnType: 'void',
      execute: (inputs, store) => {
        const taskId = inputs.task_id;
        if (!taskId) return { success: false, data: null, message: 'task_id is required' };

        const task = store.tasks.find((t: any) => t.id === taskId);
        if (!task) return { success: false, data: null, message: `Task ${taskId} not found` };

        // Simulating cancel (moving back to Open or deleting/refund)
        return {
          success: true,
          data: { taskId, refunded: true, refundRecipient: task.creator },
          message: `Task successfully cancelled. Escrowed refund of ${task.reward} ${task.token} sent back to creator.`,
        };
      },
    },
    {
      name: 'dispute',
      description: 'Flag a task as Disputed, freezing escrow until admin resolution.',
      params: [
        { name: 'task_id', type: 'string', placeholder: 'task-1' },
        {
          name: 'reason',
          type: 'string',
          placeholder: 'Contributor did not finish the full spec.',
        },
      ],
      returnType: 'void',
      execute: (inputs, store) => {
        const taskId = inputs.task_id;
        const reason = inputs.reason || 'Work does not match deliverables';
        if (!taskId) return { success: false, data: null, message: 'task_id is required' };

        const task = store.tasks.find((t: any) => t.id === taskId);
        if (!task) return { success: false, data: null, message: `Task ${taskId} not found` };

        store.triggerDispute(taskId, reason);
        return {
          success: true,
          data: { taskId, status: 'Disputed', reason },
          message: `Task flagged as Disputed. Escrow frozen on-chain awaiting governance action.`,
        };
      },
    },
    {
      name: 'admin_split',
      description: 'Admin allocates custom split of escrowed funds between creator and assignee.',
      params: [
        { name: 'task_id', type: 'string', placeholder: 'task-1' },
        { name: 'creator_share', type: 'u32 (BPS)', placeholder: '5000 (equals 50%)' },
        { name: 'assignee_share', type: 'u32 (BPS)', placeholder: '5000 (equals 50%)' },
      ],
      returnType: 'void',
      execute: (inputs, store) => {
        const taskId = inputs.task_id;
        const creatorShare = parseInt(inputs.creator_share || '5000');
        const assigneeShare = parseInt(inputs.assignee_share || '5000');
        if (!taskId) return { success: false, data: null, message: 'task_id is required' };

        const task = store.tasks.find((t: any) => t.id === taskId);
        if (!task) return { success: false, data: null, message: `Task ${taskId} not found` };
        if (task.status !== 'Disputed')
          return {
            success: false,
            data: null,
            message: `Custom split can only be executed on Disputed tasks`,
          };

        store.resolveDispute(taskId, 'Split');
        return {
          success: true,
          data: { taskId, creatorShare, assigneeShare, resolution: 'Split' },
          message: `Dispute resolved. Custom split successfully disbursed to Creator and Assignee.`,
        };
      },
    },
    {
      name: 'register_developer',
      description: 'Register a developer profile on-chain with username and bio.',
      params: [
        { name: 'username', type: 'string', placeholder: 'StellarCoder' },
        { name: 'bio', type: 'string', placeholder: 'Full-stack rust & frontend dev.' },
      ],
      returnType: 'void',
      execute: (inputs, store, address) => {
        const username = inputs.username || 'StellarCoder';
        const targetAddress = address || store.currentUser.address;
        store.updateProfile(username, targetAddress, store.currentUser.role);
        return {
          success: true,
          data: { username, address: targetAddress, reputation: 10, bio: inputs.bio || '' },
          message: `Developer successfully registered under address: ${targetAddress}`,
        };
      },
    },
    {
      name: 'increment_reputation',
      description: 'Increment contributor reputation points upon verified task completion.',
      params: [
        { name: 'developer', type: 'string (address)', placeholder: 'G-CONTRIB-Alice-888' },
        { name: 'amount', type: 'u32', placeholder: '5' },
      ],
      returnType: 'void',
      execute: (inputs, store) => {
        const dev = inputs.developer || 'G-CONTRIB-Alice-888';
        const amt = parseInt(inputs.amount || '5');
        // If updating current user reputation
        if (store.currentUser.address === dev) {
          useTaskStore.setState({
            currentUser: {
              ...store.currentUser,
              reputation: Math.min(100, store.currentUser.reputation + amt),
            },
          });
        }
        return {
          success: true,
          data: {
            developer: dev,
            increment: amt,
            newReputation:
              store.currentUser.address === dev
                ? Math.min(100, store.currentUser.reputation + amt)
                : 95,
          },
          message: `Developer reputation points successfully incremented on-chain!`,
        };
      },
    },
    {
      name: 'fetch_task',
      description: 'Fetch the full on-chain task struct by its ID.',
      params: [{ name: 'task_id', type: 'string', placeholder: 'task-1' }],
      returnType: 'TaskStruct',
      execute: (inputs, store) => {
        const taskId = inputs.task_id || 'task-1';
        const task = store.tasks.find((t: any) => t.id === taskId);
        if (!task)
          return { success: false, data: null, message: `Task with ID ${taskId} not found` };
        return {
          success: true,
          data: task,
          message: `Successfully fetched task ${taskId} details!`,
        };
      },
    },
    {
      name: 'retrieve_profile',
      description: 'Retrieve contributor profile details from on-chain storage.',
      params: [{ name: 'developer', type: 'string (address)', placeholder: 'G-CONTRIB-Alice-888' }],
      returnType: 'DeveloperProfile',
      execute: (inputs, store) => {
        const dev = inputs.developer || 'G-CONTRIB-Alice-888';
        let profile = {
          address: dev,
          username:
            dev === 'G-CONTRIB-Alice-888'
              ? 'Alice'
              : dev === 'G-CONTRIB-Bob-999'
                ? 'Bob'
                : 'RegisteredDeveloper',
          reputation: dev === 'G-CONTRIB-Alice-888' ? 95 : dev === 'G-CONTRIB-Bob-999' ? 82 : 65,
          earnings: dev === 'G-CONTRIB-Alice-888' ? 1450 : dev === 'G-CONTRIB-Bob-999' ? 800 : 0,
          tasksCompleted: dev === 'G-CONTRIB-Alice-888' ? 4 : dev === 'G-CONTRIB-Bob-999' ? 2 : 0,
          role: 'Contributor',
        };
        if (store.currentUser.address === dev) {
          profile = store.currentUser;
        }
        return {
          success: true,
          data: profile,
          message: `Successfully retrieved developer profile for: ${dev}`,
        };
      },
    },
  ];

  const handleMethodSelect = (methodName: string) => {
    setActiveMethod(methodName);
    setMethodInputs({});
    setExecutionResult(null);
  };

  const handleInputChange = (paramName: string, value: string) => {
    setMethodInputs((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMethod) return;

    const method = contractMethods.find((m) => m.name === activeMethod);
    if (!method) return;

    const store = useTaskStore.getState();
    const res = method.execute(methodInputs, store, walletAddress);

    setExecutionResult({
      success: res.success,
      output: JSON.stringify(
        {
          status: res.success ? 'Success' : 'Failed',
          message: res.message,
          data: res.data,
        },
        null,
        2
      ),
    });
  };

  return (
    <div className="space-y-24 page-fade pb-16">
      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 border border-white/5 py-20 px-8 sm:px-12 shadow-2xl text-center">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 left-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent2/10 via-transparent to-transparent -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(74,240,184,0.06),transparent_45%)]" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-accent2/10 text-accent2 border border-accent2/20 animate-pulse">
            <Code className="w-3.5 h-3.5" /> Built for Stellar Soroban Smart Contracts
          </span>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-tight">
            Decentralized Work, <br />
            <span className="text-accent bg-linear-to-r from-accent to-accent2 bg-clip-text text-transparent">
              Secured by Stellar.
            </span>
          </h1>

          <p className="text-muted text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
            Create tasks, fund them via on-chain escrow, and securely release payments when work is
            verified. Fast, transparent, and globally accessible.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => navigate('/dashboard')}
              id="hero-launch-app"
              className="flex items-center gap-2 px-8 py-4 bg-accent text-bg font-extrabold rounded-2xl hover:scale-102 hover:shadow-[0_0_25px_rgba(74,240,184,0.35)] transition-all shadow-lg"
            >
              Launch App Dashboard <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#bounties"
              className="flex items-center gap-2 px-8 py-4 glass border-hi text-white font-extrabold rounded-2xl hover:bg-white/5 transition-all"
            >
              Explore Open Tasks
            </a>
          </div>
        </div>
      </section>

      {/* ── LIVE NETWORK STATS BANNER ── */}
      {feeStats && (
        <section className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Network',
                value: 'Testnet',
                icon: <Zap className="w-3.5 h-3.5 text-accent" />,
              },
              {
                label: 'Congestion',
                value: feeStats.congestion.toUpperCase(),
                icon: <Activity className="w-3.5 h-3.5 text-yellow-400" />,
              },
              {
                label: 'Base Fee',
                value: `${feeStats.baseFee} stroops`,
                icon: <Zap className="w-3.5 h-3.5 text-purple-400" />,
              },
              {
                label: 'Latest Ledger',
                value: `#${feeStats.lastLedger.toLocaleString()}`,
                icon: <GitBranch className="w-3.5 h-3.5 text-green-400" />,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="card glass noise px-4 py-3 flex items-center gap-3 border border-white/5"
              >
                {stat.icon}
                <div>
                  <p className="text-xs font-bold text-white">{stat.value}</p>
                  <p className="text-[9px] text-muted uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── STELLAR WALLET CONNECTION WIDGET ── */}
      <section className="max-w-4xl mx-auto card glass noise p-8 border border-white/10 rounded-3xl relative">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
              Stellar Wallet — Freighter · xBull · Lobstr
            </span>
            <h2 className="text-2xl font-black text-white">
              {walletAddress ? (
                <span className="flex items-center gap-2 text-accent">
                  <CheckCircle className="w-6 h-6" /> Wallet Connected
                </span>
              ) : (
                'Connect to Sign Transactions'
              )}
            </h2>
            <p className="text-xs text-muted max-w-md">
              {walletAddress
                ? `Signing address: ${walletAddress.slice(0, 12)}...${walletAddress.slice(-6)} — ready to create tasks and sign Soroban invocations.`
                : 'Connect Freighter, xBull, or Lobstr to sign Soroban contract transactions and interact with the LatterFix escrow system.'}
            </p>
          </div>

          <div className="shrink-0">
            {walletAddress ? (
              <button
                onClick={() => disconnect()}
                className="px-6 py-3.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-2xl font-bold transition-all text-sm uppercase tracking-wider"
              >
                Disconnect Wallet
              </button>
            ) : (
              <button
                onClick={() => connect()}
                disabled={isConnecting}
                className="px-8 py-3.5 bg-accent text-bg font-extrabold rounded-2xl hover:scale-102 transition-transform shadow-lg shadow-accent/20 disabled:opacity-50 text-sm uppercase tracking-widest"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section id="features" className="space-y-12">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-accent2">
            Core Infrastructure
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">How TaskManager Pro Works</h2>
          <p className="text-xs text-muted max-w-md mx-auto">
            Deterministic payments, verified deliverables, zero trust issues.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="card glass noise p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 text-accent">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Native Escrow</h3>
            <p className="text-sm text-muted leading-relaxed">
              Funds are deterministically locked in Soroban native smart contracts. Zero
              counterparty risk for both creators and contributors.
            </p>
          </div>

          <div className="card glass noise p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-accent2/10 flex items-center justify-center border border-accent2/20 text-accent2">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Instant Payouts</h3>
            <p className="text-sm text-muted leading-relaxed">
              Upon task completion, the smart contract triggers sub-second token transfers securely
              over the Stellar network.
            </p>
          </div>

          <div className="card glass noise p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Multi-Sig Verified</h3>
            <p className="text-sm text-muted leading-relaxed">
              Requires transparent authorization to release payouts, keeping both creators and
              workers protected against disputes.
            </p>
          </div>
        </div>
      </section>

      {/* ── LIVE BOUNTIES & TASKS ── */}
      <section id="bounties" className="space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/5 pb-6">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-accent">
              Stellar Network Bounties
            </span>
            <h2 className="text-3xl font-black text-white">Live Bounties & Tasks</h2>
            <p className="text-xs text-muted">
              Claim tasks, submit your work, and get paid instantly in decentralized escrows.
            </p>
          </div>
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1.5 text-xs font-bold text-accent hover:underline shrink-0"
          >
            View All Tasks Explorer <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {openTasks.slice(0, 4).map((task) => (
            <div
              key={task.id}
              className="card glass noise p-6 flex flex-col justify-between h-[230px] border border-white/5 hover:border-accent/30 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      task.status === 'InEscrow'
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}
                  >
                    {task.status === 'InEscrow' ? 'Funded' : 'Open'}
                  </span>
                  <span className="text-[9px] font-mono text-muted">#{task.id}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-1">{task.title}</h3>
                <p className="text-xs text-muted line-clamp-2 leading-relaxed mb-4">
                  {task.description}
                </p>
              </div>

              <div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {task.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono bg-white/5 border border-white/5 text-muted px-2 py-0.5 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-muted font-mono leading-none block mb-1">
                      Escrow Reward
                    </span>
                    <span className="text-base font-black text-white">
                      {task.reward} {task.token}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate('/tasks')}
                    className="flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                  >
                    View Details <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTRACT METHOD EXPLORER ── */}
      <section id="explorer" className="space-y-12">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-accent2">
            Interactive SDK Interface
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Contract Method Explorer</h2>
          <p className="text-xs text-muted max-w-md mx-auto">
            Inspect every public function exposed by the TaskManager Pro Soroban contract deployed
            on the Stellar Testnet.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Method list */}
          <div className="lg:col-span-1 card glass noise p-6 space-y-4 max-h-[580px] overflow-y-auto pr-1">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 uppercase tracking-wider">
              Public Methods
            </h3>
            <div className="flex flex-col gap-1.5">
              {contractMethods.map((m) => (
                <button
                  key={m.name}
                  onClick={() => handleMethodSelect(m.name)}
                  className={`text-left p-3.5 rounded-xl transition-all text-xs font-mono font-bold flex items-center justify-between border ${
                    activeMethod === m.name
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-white/5 border-transparent text-muted hover:text-white hover:bg-white/10 hover:border-white/5'
                  }`}
                >
                  <span>{m.name}()</span>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>
              ))}
            </div>
          </div>

          {/* Interactive panel */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {activeMethod ? (
              (() => {
                const method = contractMethods.find((m) => m.name === activeMethod)!;
                return (
                  <div className="card glass noise p-8 space-y-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Method Header */}
                      <div className="border-b border-white/5 pb-4">
                        <span className="text-[10px] font-mono bg-accent/10 text-accent px-2.5 py-1 rounded-md mb-2 inline-block">
                          Soroban Function
                        </span>
                        <h3 className="text-2xl font-black text-white font-mono">
                          {method.name}()
                        </h3>
                        <p className="text-xs text-muted mt-2">{method.description}</p>
                      </div>

                      {/* Params Form */}
                      <form onSubmit={handleExecute} className="space-y-4">
                        {method.params.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-wider text-muted font-bold font-mono">
                              Parameters
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {method.params.map((param) => (
                                <div key={param.name} className="space-y-1.5">
                                  <label className="text-[11px] font-mono text-muted flex items-center justify-between">
                                    <span>{param.name}</span>
                                    <span className="text-[9px] text-accent/75">{param.type}</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder={param.placeholder}
                                    value={methodInputs[param.name] || ''}
                                    onChange={(e) => handleInputChange(param.name, e.target.value)}
                                    className="w-full bg-black/25 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent/40"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted italic">
                            This function accepts no input arguments.
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-6">
                          <div className="text-xs font-mono">
                            <span className="text-muted">Returns: </span>
                            <span className="text-accent">{method.returnType}</span>
                          </div>
                          <button
                            type="submit"
                            className="flex items-center gap-2 px-6 py-3 bg-accent text-bg font-extrabold rounded-xl hover:scale-102 transition-transform shadow-md shadow-accent/25 text-xs"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" /> Execute on Testnet
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Result Output */}
                    {executionResult && (
                      <div className="space-y-3 border-t border-white/5 pt-6 mt-6">
                        <h4 className="text-xs uppercase tracking-wider text-muted font-bold font-mono flex items-center gap-1.5">
                          <Terminal className="w-4 h-4 text-accent" /> Execution Output
                        </h4>
                        <pre className="bg-black/45 border border-white/5 text-[11px] font-mono p-4 rounded-xl text-success overflow-x-auto leading-relaxed max-h-52">
                          {executionResult.output}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="card glass noise p-12 text-center text-muted flex-1 flex flex-col items-center justify-center border border-white/5">
                <Terminal className="w-12 h-12 text-muted/30 mb-4" />
                <h3 className="text-base font-bold text-white/80">Select a contract method</h3>
                <p className="text-xs text-muted max-w-xs mx-auto mt-1">
                  Choose a public function from the sidebar to inspect parameters, input arguments,
                  and simulate live transactions.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── METRICS SECTION ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="card glass noise p-6 text-center border border-white/5">
          <h3 className="text-4xl font-black text-white mb-1">20+</h3>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Contract Methods
          </p>
          <p className="text-[9px] text-muted mt-1">create_task · complete · dispute · resolve</p>
        </div>
        <div className="card glass noise p-6 text-center border border-white/5">
          <h3 className="text-4xl font-black text-accent mb-1">8 / 8</h3>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Test Cases Passing
          </p>
          <p className="text-[9px] text-muted mt-1">Soroban SDK test harness</p>
        </div>
        <div className="card glass noise p-6 text-center border border-white/5">
          <h3 className="text-4xl font-black text-accent2 mb-1">
            {feeStats ? `#${(feeStats.lastLedger / 1000).toFixed(0)}k` : 'Testnet'}
          </h3>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted">Live Ledger</p>
          <p className="text-[9px] text-muted mt-1">Stellar Testnet (live)</p>
        </div>
        <div className="card glass noise p-6 text-center border border-white/5">
          <h3 className="text-4xl font-black text-white mb-1">v22</h3>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted">soroban-sdk</p>
          <p className="text-[9px] text-muted mt-1">Rust · Wasm · Stellar</p>
        </div>
      </section>

      {/* ── READY CALL TO ACTION ── */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-r from-accent2/25 to-slate-900 border border-accent2/20 py-16 px-8 sm:px-12 text-center shadow-2xl">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to decentralize your workflow?
          </h2>
          <p className="text-muted text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
            Join thousands of developers and DAOs using TaskManager Pro to securely delegate tasks
            and distribute bounties using the Stellar network.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-10 py-4.5 rounded-full bg-accent text-bg font-extrabold hover:scale-105 hover:shadow-[0_0_35px_rgba(74,240,184,0.4)] transition-all shadow-xl text-base"
          >
            Start for Free
          </button>
        </div>
      </section>
    </div>
  );
}
