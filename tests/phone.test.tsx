import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallsExperience } from '@/components/calls-experience';
import { getDictionary } from '@/i18n/dictionaries';
import { CONTACTS_KEY, internationalNumber, readContacts } from '@/modules/calls/phone';

beforeEach(() => localStorage.removeItem(CONTACTS_KEY));

describe('Phone experience', () => {
  it('handles local, international and 00 prefixes without double country codes', () => {
    expect(internationalNumber('050-123-4567', '972')).toBe('+972501234567');
    expect(internationalNumber('+36 20 123 4567', '972')).toBe('+36201234567');
    expect(internationalNumber('0036201234567', '972')).toBe('+36201234567');
    expect(internationalNumber('123', '972')).toBeNull();
    expect(internationalNumber('*123#', '972')).toBeNull();
  });
  it('ignores malformed saved contact data', () => {
    localStorage.setItem(CONTACTS_KEY, '{broken');
    expect(readContacts()).toEqual([]);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify([{ name: 'Missing phone' }, { id: '1', name: 'Test', number: '+972501234567', favorite: false }]));
    expect(readContacts()).toHaveLength(1);
  });
  it('persists contacts, finds them, favorites them and loads their number into the keypad', () => {
    render(<CallsExperience t={getDictionary('en')}/>);
    fireEvent.click(screen.getByRole('tab', { name: 'Contacts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test contact' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '0501234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    expect(readContacts()[0]).toMatchObject({ name: 'Test contact', number: '+972501234567' });
    fireEvent.change(screen.getByLabelText('Search contacts'), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Favorite Test contact' }));
    expect(readContacts()[0].favorite).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Dial Test contact' }));
    expect(screen.getByLabelText('Phone number')).toHaveValue('+972501234567');
  });
  it('never records or charges a call when no service is connected', () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    render(<CallsExperience t={getDictionary('en')}/>);
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '0501234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start call' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('No call is placed');
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Recents' }));
    expect(screen.getByText('Every call, in one place')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Wallet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Top up wallet' }));
    expect(screen.getByRole('button', { name: 'Payment — coming soon' })).toBeDisabled();
    fetcher.mockRestore();
  });
});
