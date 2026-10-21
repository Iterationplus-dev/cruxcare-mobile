import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppSheetSelect from '@/components/ui/AppSheetSelect.vue';

function picker() {
  return mount(AppSheetSelect, {
    props: {
      modelValue: '', searchable: true,
      options: [{ value: '1', label: 'Lagos' }, { value: '2', label: 'Akwa Ibom' }],
    },
    global: { stubs: { AppSheet: { template: '<div><slot /></div>' } } },
  });
}

describe('AppSheetSelect search', () => {
  it('filters labels, selects the original id, and resets when reopened', async () => {
    const wrapper = picker();
    await wrapper.get('.cc-sheet-select__trigger').trigger('click');
    await wrapper.get('input').setValue('  AKWA ');
    expect(wrapper.findAll('.cc-sheet-select__option').map((row) => row.text())).toEqual(['Akwa Ibom']);
    await wrapper.get('.cc-sheet-select__option').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['2']]);
    await wrapper.get('.cc-sheet-select__trigger').trigger('click');
    expect(wrapper.findAll('.cc-sheet-select__option')).toHaveLength(2);
    await wrapper.get('input').setValue('missing');
    expect(wrapper.get('[role="status"]').text()).toContain('No matches');
    await wrapper.get('input').setValue('');
    expect(wrapper.findAll('.cc-sheet-select__option')).toHaveLength(2);
  });

  it('offers retry after a failed lookup and shows options after recovery', async () => {
    const wrapper = picker();
    await wrapper.setProps({ loadError: true });
    await wrapper.get('[role="alert"] button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
    await wrapper.setProps({ loadError: false, loading: true });
    expect(wrapper.get('[role="status"]').text()).toContain('Loading');
    await wrapper.setProps({ loading: false });
    expect(wrapper.findAll('.cc-sheet-select__option')).toHaveLength(2);
  });
});
