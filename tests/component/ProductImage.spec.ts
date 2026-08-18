import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ProductImage from '@/components/marketplace/ProductImage.vue';

describe('ProductImage', () => {
  it('uses the CDN URL exactly as returned by the API', async () => {
    const url = 'https://res.cloudinary.com/example/image/upload/f_auto,q_100/products/item-21';
    const wrapper = mount(ProductImage, {
      props: { name: 'Care Blood Activator', media: [{ url, alt: 'Care Blood Activator' }] },
    });

    expect(wrapper.find('img').attributes('src')).toBe(url);
    expect(wrapper.find('img').attributes('loading')).toBe('lazy');
    expect(wrapper.find('img').attributes('decoding')).toBe('async');
    expect(wrapper.find('.cc-product-image__loader').exists()).toBe(true);

    await wrapper.find('img').trigger('load');
    expect(wrapper.find('.cc-product-image__loader').exists()).toBe(false);
  });

  it('renders an accessible neutral placeholder when media is empty', () => {
    const wrapper = mount(ProductImage, { props: { name: 'Care Blood Activator', media: [] } });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Care Blood Activator image unavailable');
  });

  it('falls back to the placeholder after an image load failure', async () => {
    const wrapper = mount(ProductImage, {
      props: { name: 'Care Blood Activator', media: [{ url: 'https://cdn.example.test/missing', alt: '' }] },
    });

    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Care Blood Activator image unavailable');
  });
});
