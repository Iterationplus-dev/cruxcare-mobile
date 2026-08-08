import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppButton from '@/components/ui/AppButton.vue';

describe('AppButton', () => {
  it('renders the default slot as its label', () => {
    const wrapper = mount(AppButton, { slots: { default: 'Confirm order' } });
    expect(wrapper.text()).toBe('Confirm order');
  });

  it('disables the button and sets aria-busy while loading', () => {
    const wrapper = mount(AppButton, { props: { loading: true }, slots: { default: 'Submit' } });
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('button').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('.cc-btn__spinner').exists()).toBe(true);
  });

  it('emits click when enabled', async () => {
    const wrapper = mount(AppButton, { slots: { default: 'Go' } });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('does not emit click while disabled', async () => {
    const wrapper = mount(AppButton, { props: { disabled: true }, slots: { default: 'Go' } });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });

  it('applies the destructive-text variant class', () => {
    const wrapper = mount(AppButton, { props: { variant: 'destructive-text' }, slots: { default: 'Delete' } });
    expect(wrapper.find('button').classes()).toContain('cc-btn--destructive-text');
  });
});
