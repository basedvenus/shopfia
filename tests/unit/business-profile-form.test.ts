import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/components/ui/validated-form', () => ({ ValidatedForm: (props: object) => React.createElement('form', props) }));
import { BusinessProfileForm, BusinessDescription } from '@/components/vendor/business-profile-form';

describe('business setup retains entries', () => {
  async function submit(bio: string, action: (data: FormData) => Promise<{ error: string }>) {
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => callback());
    const OriginalFormData = globalThis.FormData;
    vi.stubGlobal('FormData', class { get() { return bio; } });
    const view = create(React.createElement(BusinessProfileForm, { action, children: React.createElement(BusinessDescription, { defaultValue: bio }) }));
    await act(async () => { await view.root.findByType('form').props.onSubmit({ preventDefault: vi.fn(), currentTarget: {} }); });
    vi.stubGlobal('FormData', OriginalFormData);
    return view;
  }
  it('keeps an over-limit description intact without sending a save', async () => {
    const action = vi.fn();
    const view = await submit('a'.repeat(601), action);
    expect(action).not.toHaveBeenCalled();
    expect(view.root.findByType('textarea').props.value).toHaveLength(601);
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('600');
  });
  it('keeps values and enables retry after a server validation failure', async () => {
    const view = await submit('My business description', vi.fn().mockResolvedValue({ error: 'That username is taken.' }));
    expect(view.root.findByType('textarea').props.value).toBe('My business description');
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('username');
    expect(view.root.findByType('fieldset').props.disabled).toBe(false);
  });
  it('keeps values after a network failure', async () => {
    const view = await submit('My business description', vi.fn().mockRejectedValue(new Error('offline')));
    expect(view.root.findByType('textarea').props.value).toBe('My business description');
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('connection');
  });
});
