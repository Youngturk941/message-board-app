import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { messageBoardAbi, messageBoardAddress } from './messageBoardContract.js';
import { monadTestnet } from './web3.jsx';

export default function App() {
  const [draftMessage, setDraftMessage] = useState('');
  const [feedback, setFeedback] = useState(null);
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const {
    data: currentMessage,
    error: readError,
    isLoading: isMessageLoading,
    refetch: refetchMessage
  } = useReadContract({
    address: messageBoardAddress,
    abi: messageBoardAbi,
    functionName: 'getMessage',
    chainId: monadTestnet.id
  });
  const {
    data: transactionHash,
    error: writeError,
    isPending: isWritePending,
    writeContractAsync
  } = useWriteContract();
  const {
    error: receiptError,
    isLoading: isConfirming,
    isSuccess: isConfirmed
  } = useWaitForTransactionReceipt({
    chainId: monadTestnet.id,
    hash: transactionHash
  });
  const isWrongChain = isConnected && chainId !== monadTestnet.id;
  const isSubmitting = isSwitchingChain || isWritePending || isConfirming;
  const isUpdateDisabled = !isConnected || !draftMessage.trim() || isSubmitting;

  useEffect(() => {
    if (!writeError) {
      return;
    }

    setFeedback({
      type: 'error',
      text: writeError.shortMessage || writeError.message || 'Transaction was rejected.'
    });
  }, [writeError]);

  useEffect(() => {
    if (!receiptError) {
      return;
    }

    setFeedback({
      type: 'error',
      text: receiptError.shortMessage || receiptError.message || 'Transaction failed.'
    });
  }, [receiptError]);

  useEffect(() => {
    async function syncConfirmedMessage() {
      if (!isConfirmed) {
        return;
      }

      try {
        await refetchMessage();
        setDraftMessage('');
        setFeedback({
          type: 'success',
          text: 'Message updated on Monad testnet.'
        });
      } catch (error) {
        setFeedback({
          type: 'error',
          text: error.message || 'Transaction confirmed, but the message could not be refreshed.'
        });
      }
    }

    syncConfirmedMessage();
  }, [isConfirmed, refetchMessage]);

  async function ensureMonadNetwork() {
    if (!isWrongChain && !window.ethereum?.request) {
      return;
    }

    const chainIdHex = `0x${monadTestnet.id.toString(16)}`;
    const chainParams = {
      chainId: chainIdHex,
      chainName: monadTestnet.name,
      nativeCurrency: monadTestnet.nativeCurrency,
      rpcUrls: monadTestnet.rpcUrls.default.http,
      blockExplorerUrls: monadTestnet.blockExplorers ? [monadTestnet.blockExplorers.default.url] : []
    };

    if (window.ethereum?.request) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainParams]
        });
        return;
      } catch (error) {
        const chainKnown =
          error?.code === 4001 ||
          error?.code === -32603 ||
          `${error?.message || ''}`.toLowerCase().includes('already');

        if (!chainKnown) {
          throw error;
        }
      }
    }

    if (!isWrongChain) {
      return;
    }

    if (switchChainAsync) {
      try {
        await switchChainAsync({ chainId: monadTestnet.id });
        return;
      } catch (error) {
        if (!window.ethereum?.request) {
          throw error;
        }
      }
    }

    if (window.ethereum?.request) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });
      return;
    }

    throw new Error('Switch your wallet to Monad testnet to continue.');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isConnected || !draftMessage.trim()) {
      return;
    }

    setFeedback(null);

    try {
      await ensureMonadNetwork();
      await writeContractAsync({
        address: messageBoardAddress,
        abi: messageBoardAbi,
        functionName: 'setMessage',
        args: [draftMessage.trim()],
        chainId: monadTestnet.id
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.shortMessage || error.message || 'Unable to send transaction.'
      });
    }
  }

  const messageText = isMessageLoading
    ? 'Loading...'
    : readError
      ? 'Unable to load message'
      : currentMessage;
  const networkLabel = isWrongChain ? 'Wrong network' : 'Monad Testnet';
  const walletLabel = isConnected ? 'Wallet connected' : 'Wallet required';
  const helperText = isWritePending
    ? 'Check your wallet to confirm the transaction.'
    : isConfirming
      ? 'Transaction sent. Waiting for confirmation...'
      : isWrongChain
        ? 'Switch to Monad testnet to update the message.'
        : !isConnected
          ? 'Connect your wallet to update the shared message.'
          : null;

  return (
    <div className="app">
      <header className="header">
        <div className="title-block">
          <p className="kicker">Shared on-chain board</p>
          <h1>Message Board</h1>
        </div>
        <ConnectButton showBalance={false} />
      </header>

      <main className="content">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="hero-label">Live message</p>
            <h2>One message, shared by every connected wallet on Monad testnet.</h2>
          </div>
          <div className="hero-meta">
            <div className={`meta-pill ${isWrongChain ? 'meta-pill-warning' : ''}`}>
              <span className="meta-dot" />
              {networkLabel}
            </div>
            <div className="meta-pill">{walletLabel}</div>
          </div>
        </section>

        <section className="message-card" aria-labelledby="message-title">
          <div className="message-card-top">
            <p className="eyebrow">Current message</p>
            <p className="message-source">Read directly from the deployed contract</p>
          </div>
          <h3 id="message-title">{messageText}</h3>
        </section>

        <section className="composer-shell">
          <div className="composer-copy">
            <p className="eyebrow">Post update</p>
            <h3>Write the next shared message</h3>
            <p className="composer-note">
              The displayed message changes only after the transaction confirms on-chain.
            </p>
          </div>

          <form className="composer" aria-label="Message composer" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Write a new on-chain message"
              value={draftMessage}
              onChange={(event) => {
                setDraftMessage(event.target.value);
                setFeedback(null);
              }}
            />
            <button type="submit" disabled={isUpdateDisabled}>
              {isSubmitting ? 'Updating...' : 'Update Message'}
            </button>
          </form>
        </section>

        {(helperText || feedback) && (
          <section className="status-panel" aria-live="polite">
            {helperText && <p className="status-text">{helperText}</p>}
            {feedback && (
              <p className={`status-text ${feedback.type === 'error' ? 'status-error' : 'status-success'}`}>
                {feedback.text}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
