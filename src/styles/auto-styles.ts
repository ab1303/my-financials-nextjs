/**
 * Utility functions for applying theme styles without explicit imports
 * These can be used in components that don't want to import theme utilities
 */

// Auto-apply component classes using data attributes
export const applyComponentStyles = () => {
  if (typeof window === 'undefined') return;

  // Apply card styles based on data attributes
  document.querySelectorAll('[data-component="card"]').forEach((el) => {
    const variant = el.getAttribute('data-variant') || 'base';
    const element = el as HTMLElement;

    // Remove existing card classes
    element.classList.remove(
      'card',
      'card-interactive',
      'card-elevated',
      'card-flat',
    );

    // Apply new class based on variant
    switch (variant) {
      case 'interactive':
        element.classList.add('card-interactive');
        break;
      case 'elevated':
        element.classList.add('card-elevated');
        break;
      case 'flat':
        element.classList.add('card-flat');
        break;
      default:
        element.classList.add('card');
    }
  });

  // Apply button styles based on data attributes
  document.querySelectorAll('[data-component="button"]').forEach((el) => {
    const variant = el.getAttribute('data-variant') || 'primary';
    const element = el as HTMLElement;

    // Remove existing button classes
    element.classList.remove('btn-primary', 'btn-secondary', 'btn-icon');

    // Apply new class based on variant
    switch (variant) {
      case 'secondary':
        element.classList.add('btn-secondary');
        break;
      case 'icon':
        element.classList.add('btn-icon');
        break;
      default:
        element.classList.add('btn-primary');
    }
  });

  // Apply navigation styles
  document.querySelectorAll('[data-component="nav-sidebar"]').forEach((el) => {
    (el as HTMLElement).classList.add('nav-sidebar');
  });

  document.querySelectorAll('[data-component="nav-item"]').forEach((el) => {
    (el as HTMLElement).classList.add('nav-item');
  });

  document
    .querySelectorAll('[data-component="nav-item-group"]')
    .forEach((el) => {
      (el as HTMLElement).classList.add('nav-item-group');
    });

  // Apply modal styles
  document.querySelectorAll('[data-component="modal-body"]').forEach((el) => {
    const variant = el.getAttribute('data-variant') || 'base';
    const element = el as HTMLElement;

    if (variant === 'flowbite') {
      element.classList.add('modal-body-flowbite');
    }
  });
};

// Initialize auto-styling when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyComponentStyles);
  } else {
    applyComponentStyles();
  }

  // Re-apply styles when content changes (for dynamic content)
  const observer = new MutationObserver((mutations) => {
    let shouldReapply = false;

    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.hasAttribute('data-component')) {
              shouldReapply = true;
            }
          }
        });
      }
    });

    if (shouldReapply) {
      applyComponentStyles();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

export default applyComponentStyles;
