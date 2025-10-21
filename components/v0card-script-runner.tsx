'use client';

import { useEffect, useRef } from 'react';

interface V0CardScriptRunnerProps {
  cardId: string;
  script: string;
}

export function V0CardScriptRunner({ cardId, script }: V0CardScriptRunnerProps) {
  const workerRef = useRef<Worker | null>(null);
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  useEffect(() => {
    console.log(`[V0CardScriptRunner] Initializing for card ${cardId}`);
    console.log(`[V0CardScriptRunner] Script execution started: ${new Date().toISOString()}`);

    // Fix: Check iframe readiness before proceeding
    const waitForIframe = () => {
      return new Promise((resolve, reject) => {
        const iframe = document.querySelector(`iframe[title*="v0-card-${cardId}"]`) as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          console.log(`[V0CardScriptRunner] Iframe ready for card ${cardId}`);
          resolve(iframe);
        } else {
          console.log(`[V0CardScriptRunner] Waiting for iframe for card ${cardId}`);
          const timeout = setTimeout(() => {
            console.error(`[V0CardScriptRunner] Iframe timeout for card ${cardId}`);
            reject(new Error('Iframe timeout'));
          }, 5000);

          const observer = new MutationObserver(() => {
            const iframe = document.querySelector(`iframe[title*="v0-card-${cardId}"]`) as HTMLIFrameElement;
            if (iframe && iframe.contentWindow) {
              clearTimeout(timeout);
              observer.disconnect();
              console.log(`[V0CardScriptRunner] Iframe found for card ${cardId}`);
              resolve(iframe);
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    };

    waitForIframe().then(() => {
      console.log(`[V0CardScriptRunner] Proceeding with script execution for card ${cardId}`);
      initializeWorker();
    }).catch((error) => {
      console.error(`[V0CardScriptRunner] Failed to initialize for card ${cardId}:`, error);
    });

    const initializeWorker = () => {
    // Create worker with the API bridge
    const workerCode = `
      // Web Worker Environment
      const eventSources = new Map();

      const api = {
        subscribe: (urlOrConfig, paramsOrEvent) => {
          let id, url, event;

          // Handle both old and new API signatures
          if (typeof urlOrConfig === 'string') {
            // Legacy format: api.subscribe(url, params)
            url = urlOrConfig;
            id = 'stream-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            event = paramsOrEvent || 'tick';

            // If params provided, append as query string
            if (paramsOrEvent && typeof paramsOrEvent === 'object') {
              const searchParams = new URLSearchParams(paramsOrEvent);
              url += (url.includes('?') ? '&' : '?') + searchParams.toString();
              event = 'tick'; // Default event type for telemetry
            }
          } else {
            // New format: api.subscribe({ id, url, event })
            ({ id, url, event } = urlOrConfig);
          }

          console.log('[Worker] Subscribing to:', url, 'with event:', event, 'id:', id);
          self.postMessage({
            type: 'subscribe',
            data: { id, url, event }
          });
        },
        on: (eventTypeOrStreamId, callback) => {
          self.addEventListener('message', (e) => {
            // Handle different event types
            if (eventTypeOrStreamId === 'tick' && e.data.type === 'stream-data') {
              callback(e.data.data);
            } else if (eventTypeOrStreamId === 'open' && e.data.type === 'stream-connected') {
              callback(e.data);
            } else if (eventTypeOrStreamId === 'error' && e.data.type === 'stream-error') {
              callback(e.data.error);
            } else if (eventTypeOrStreamId === 'close' && e.data.type === 'stream-closed') {
              callback(e.data);
            } else if (e.data.type === 'stream-data' && e.data.streamId === eventTypeOrStreamId) {
              // Handle specific streamId matching
              callback(e.data.data);
            }
          });
        },
        onError: (streamId, errorCallback) => {
          self.addEventListener('message', (e) => {
            if (e.data.type === 'stream-error' && e.data.streamId === streamId) {
              errorCallback(e.data.error);
            }
          });
        },
        onConnected: (streamId, connectedCallback) => {
          self.addEventListener('message', (e) => {
            if (e.data.type === 'stream-connected' && e.data.streamId === streamId) {
              connectedCallback(e.data.status);
            }
          });
        },
        postText: (slotIdOrConfig, text) => {
          let slotId;

          // Handle both API signatures
          if (typeof slotIdOrConfig === 'string') {
            // Legacy format: api.postText(slotId, text)
            slotId = slotIdOrConfig;
          } else {
            // New format: api.postText({ slotId }, text)
            ({ slotId } = slotIdOrConfig);
          }

          console.log('[Worker] Posting text to slot:', slotId, 'text:', text);
          self.postMessage({
            type: 'update-slot',
            slotId,
            html: text,
            isText: true
          });
        },
        replaceSlot: (slotIdOrConfig, html) => {
          let slotId;

          // Handle both API signatures
          if (typeof slotIdOrConfig === 'string') {
            // Legacy format: api.replaceSlot(slotId, html)
            slotId = slotIdOrConfig;
          } else {
            // New format: api.replaceSlot({ slotId }, html)
            ({ slotId } = slotIdOrConfig);
          }

          console.log('[Worker] Replacing slot:', slotId, 'with:', html);
          self.postMessage({
            type: 'update-slot',
            slotId,
            html,
            isText: false
          });
        },
        log: (...args) => console.log('[Worker]', ...args),
        error: (msg, details) => console.error('[Worker Error]', msg, details),
        // Add debug method for testing
        debug: (...args) => console.log('[Worker Debug]', ...args)
      };
      
      // Fix: Add script execution timeout and error boundaries
      const SCRIPT_TIMEOUT = 30000; // 30 seconds
      const scriptStartTime = Date.now();

      const checkTimeout = () => {
        if (Date.now() - scriptStartTime > SCRIPT_TIMEOUT) {
          throw new Error('Script execution timeout after 30 seconds');
        }
      };

      // Monitor for timeout during script execution
      const timeoutMonitor = setInterval(checkTimeout, 1000);

      // Execute the AI-generated script with enhanced error handling
      try {
        console.log('[Worker] Starting script execution...');
        ` + script + `
        clearInterval(timeoutMonitor);
        console.log('[Worker] Script execution completed successfully');
      } catch (error) {
        clearInterval(timeoutMonitor);
        console.error('[Worker] Script execution error:', error);
        self.postMessage({
          type: 'script-error',
          error: {
            message: error.message || 'Unknown script error',
            stack: error.stack,
            timestamp: new Date().toISOString(),
            cardId: '` + cardId + `'
          }
        });
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    // Handle worker messages
    worker.onmessage = (event) => {
      const { type, data, slotId, html } = event.data;
      console.log(`[V0CardScriptRunner] Received worker message:`, { type, data, slotId });

      if (type === 'subscribe') {
        // Create EventSource in main thread
        const { id: streamId, url, event: eventName } = data;
        console.log(`[V0CardScriptRunner] Creating EventSource for ${streamId}`);

        // Fix: Convert relative URLs to absolute for EventSource compatibility
        const absoluteUrl = url.startsWith('http')
          ? url
          : `${window.location.origin}${url}`;
        console.log(`[V0CardScriptRunner] Original URL: ${url}`);
        console.log(`[V0CardScriptRunner] Window origin: ${window.location.origin}`);
        console.log(`[V0CardScriptRunner] Resolved URL: ${absoluteUrl}`);

        // Fix: Validate stream endpoint before creating EventSource
        const validateStreamEndpoint = async (url: string): Promise<boolean> => {
          try {
            console.log(`[V0CardScriptRunner] Validating stream endpoint: ${url}`);
            const response = await fetch(url, { method: 'HEAD' });
            const isValid = response.ok;
            console.log(`[V0CardScriptRunner] Stream validation result for ${url}: ${isValid ? 'valid' : 'invalid'}`);
            return isValid;
          } catch (error) {
            console.error(`[V0CardScriptRunner] Stream validation error for ${url}:`, error);
            return false;
          }
        };

        // Validate stream before attempting connection
        validateStreamEndpoint(absoluteUrl).then((isValid) => {
          if (!isValid) {
            console.error(`[V0CardScriptRunner] Stream endpoint not accessible: ${absoluteUrl}`);
            worker.postMessage({
              type: 'stream-error',
              streamId,
              error: {
                message: `Stream endpoint not accessible: ${url}`,
                timestamp: new Date().toISOString(),
                validation: 'failed'
              }
            });
            return;
          }

          // Proceed with EventSource creation
          createAndManageEventSource();
        });

        // Fix: Create EventSource with retry logic
        const createAndManageEventSource = () => {
        const createEventSourceWithRetry = (url: string, streamId: string, maxRetries = 3) => {
          let retryCount = 0;

          const attemptConnection = (): EventSource => {
            console.log(`[V0CardScriptRunner] Attempt ${retryCount + 1}/${maxRetries + 1} for ${streamId}`);
            const eventSource = new EventSource(url);

            eventSource.addEventListener('open', () => {
              console.log(`[V0CardScriptRunner] Connected to ${streamId}`);
              retryCount = 0; // Reset on successful connection
              worker.postMessage({
                type: 'stream-connected',
                streamId,
                status: 'connected'
              });
            });

            eventSource.addEventListener(eventName || 'message', (e) => {
              const streamData = JSON.parse(e.data);
              console.log(`[V0CardScriptRunner] Received data for ${streamId}:`, streamData);
              worker.postMessage({
                type: 'stream-data',
                streamId,
                data: streamData
              });
            });

            eventSource.onerror = (error) => {
              console.error(`[V0CardScriptRunner] EventSource error for ${streamId}:`, error, 'ReadyState:', eventSource.readyState);

              // Send error to worker
              worker.postMessage({
                type: 'stream-error',
                streamId,
                error: {
                  message: 'EventSource connection failed',
                  readyState: eventSource.readyState,
                  timestamp: new Date().toISOString(),
                  retryAttempt: retryCount + 1
                }
              });

              // Retry logic
              if (retryCount < maxRetries && eventSource.readyState === EventSource.CLOSED) {
                retryCount++;
                const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                console.log(`[V0CardScriptRunner] Retrying ${streamId} in ${backoffDelay}ms`);

                setTimeout(() => {
                  eventSource.close();
                  // Send close event to worker
                  worker.postMessage({
                    type: 'stream-closed',
                    streamId,
                    reason: 'retry_attempt'
                  });
                  const newEventSource = attemptConnection();
                  eventSourcesRef.current.set(streamId, newEventSource);
                }, backoffDelay);
              }
            };

            return eventSource;
          };

          return attemptConnection();
        };

        const eventSource = createEventSourceWithRetry(absoluteUrl, streamId);
        eventSourcesRef.current.set(streamId, eventSource);
        }; // End createAndManageEventSource
      } else if (type === 'script-error') {
        // Handle script execution errors
        console.error(`[V0CardScriptRunner] Script error in card ${cardId}:`, data.error);
      } else if (type === 'update-slot') {
        // Update the v0Card iframe with enhanced debugging
        const iframe = document.querySelector(`iframe[title*="v0-card-${cardId}"]`) as HTMLIFrameElement;
        console.log(`[V0CardScriptRunner] Looking for iframe with cardId: ${cardId}`);
        console.log(`[V0CardScriptRunner] Found iframe:`, iframe);

        if (iframe && iframe.contentWindow) {
          console.log(`[V0CardScriptRunner] Sending postMessage to iframe:`, {
            slotId,
            html: html?.substring(0, 100) + '...'
          });

          iframe.contentWindow.postMessage({
            __v0parent: true,
            id: cardId,
            type: 'replace-slot',
            slotId,
            html
          }, '*');

          // Also try direct DOM manipulation as fallback
          try {
            const slotElement = iframe.contentDocument?.querySelector(`[data-slot-id="${slotId}"]`);
            if (slotElement) {
              console.log(`[V0CardScriptRunner] Direct DOM update for slot: ${slotId}`);
              slotElement.innerHTML = html;
            } else {
              console.log(`[V0CardScriptRunner] Slot element not found: ${slotId}`);
            }
          } catch (e) {
            console.log(`[V0CardScriptRunner] Direct DOM access failed:`, e);
          }
        } else {
          console.error(`[V0CardScriptRunner] Iframe not found or not ready for card: ${cardId}`);
        }
      }
    };

    worker.onerror = (error) => {
      console.error('[V0CardScriptRunner] Worker error:', error);
    };

    // Fix: Add heartbeat logging for debugging
    const heartbeatInterval = setInterval(() => {
      console.log(`[V0CardScriptRunner] Status check - Worker active: ${workerRef.current ? 'yes' : 'no'}, EventSources: ${eventSourcesRef.current.size}, Card: ${cardId}`);
    }, 15000); // Every 15 seconds

    const cleanup = () => {
      // Cleanup
      console.log(`[V0CardScriptRunner] Cleaning up for card ${cardId}`);
      clearInterval(heartbeatInterval);

      // Send close events for all active streams
      eventSourcesRef.current.forEach((es, streamId) => {
        if (workerRef.current) {
          workerRef.current.postMessage({
            type: 'stream-closed',
            streamId,
            reason: 'cleanup'
          });
        }
        es.close();
      });

      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      eventSourcesRef.current.clear();
    };

    return cleanup;
    }; // End initializeWorker

    // No cleanup initially - waitForIframe handles success/error cases
    return () => {};
  }, [cardId, script]);

  return null;
}