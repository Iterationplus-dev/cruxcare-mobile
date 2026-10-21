import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import OtpInput from '@/components/ui/OtpInput.vue';

function mountOtp() {
  return mount(OtpInput, {
    props: { modelValue: '', length: 5, 'onUpdate:modelValue': () => {} },
    attachTo: document.body,
  });
}

function boxes(wrapper: ReturnType<typeof mountOtp>) {
  return wrapper.findAll('input');
}

function lastValue(wrapper: ReturnType<typeof mountOtp>) {
  return wrapper.emitted('update:modelValue')?.at(-1)?.[0];
}

describe('OtpInput', () => {
  it('spreads a whole code pasted through a keyboard input event', async () => {
    // Android clipboard chips arrive as `input`, not `paste`.
    const wrapper = mountOtp();
    await boxes(wrapper)[0].setValue('48291');

    expect(lastValue(wrapper)).toBe('48291');
    expect(wrapper.emitted('complete')?.[0]).toEqual(['48291']);
    expect(boxes(wrapper).map((b) => (b.element as HTMLInputElement).value)).toEqual(['4', '8', '2', '9', '1']);
    wrapper.unmount();
  });

  it('strips non-digits from a pasted code', async () => {
    const wrapper = mountOtp();
    await boxes(wrapper)[0].trigger('paste', {
      clipboardData: { getData: () => 'Code: 48 291' },
    });

    expect(lastValue(wrapper)).toBe('48291');
    wrapper.unmount();
  });

  it('keeps the digit just typed when overwriting a filled box', async () => {
    const wrapper = mountOtp();
    await boxes(wrapper)[0].setValue('3');
    await boxes(wrapper)[0].setValue('37');

    expect(lastValue(wrapper)).toBe('7');
    wrapper.unmount();
  });
});
