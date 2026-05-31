type VisibilityCallback = (isIntersecting: boolean) => void;

type ObserverBucket = {
  callbacks: Map<Element, VisibilityCallback>;
  observer: IntersectionObserver;
};

const observersByMargin = new Map<string, ObserverBucket>();

const getObserverBucket = (rootMargin: string): ObserverBucket => {
  const existing = observersByMargin.get(rootMargin);
  if (existing) return existing;

  const callbacks = new Map<Element, VisibilityCallback>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const callback = callbacks.get(entry.target);
        if (callback) {
          callback(entry.isIntersecting);
        }
      }
    },
    { rootMargin },
  );

  const bucket = { callbacks, observer };
  observersByMargin.set(rootMargin, bucket);
  return bucket;
};

export const observeVisibility = (
  element: Element,
  callback: VisibilityCallback,
  rootMargin: string,
) => {
  const bucket = getObserverBucket(rootMargin);
  bucket.callbacks.set(element, callback);
  bucket.observer.observe(element);

  return () => {
    bucket.callbacks.delete(element);
    bucket.observer.unobserve(element);
  };
};
