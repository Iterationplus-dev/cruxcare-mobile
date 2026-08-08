import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MoneyAmount from '@/components/ui/MoneyAmount.vue';

describe('MoneyAmount', () => {
  it('formats a plain USD amount', () => {
    const wrapper = mount(MoneyAmount, { props: { value: 1240 } });
    expect(wrapper.text()).toBe('$1,240.00');
  });

  it('shows an explicit sign when showSign is set', () => {
    const wrapper = mount(MoneyAmount, { props: { value: 36, showSign: true } });
    expect(wrapper.text()).toBe('+$36.00');
    expect(wrapper.classes()).toContain('cc-money--success');
  });

  it('tones a negative signed amount as danger', () => {
    const wrapper = mount(MoneyAmount, { props: { value: -74.88, showSign: true } });
    expect(wrapper.text()).toBe('-$74.88');
    expect(wrapper.classes()).toContain('cc-money--danger');
  });

  it('respects an explicit tone override even without showSign', () => {
    const wrapper = mount(MoneyAmount, { props: { value: 12, tone: 'warning' } });
    expect(wrapper.classes()).toContain('cc-money--warning');
  });

  it('formats a non-USD currency code', () => {
    const wrapper = mount(MoneyAmount, { props: { value: 500, currency: 'NGN' } });
    expect(wrapper.text()).toContain('500.00');
  });
});
