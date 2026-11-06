/// <reference lib="dom" />
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ReactModule from 'react';
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { makeDropdown } from './select.js';

afterEach(() => {
  cleanup();
});

function Dropdown(props: Partial<Record<string, unknown>> = {}) {
  const Component = makeDropdown(ReactModule);
  return createElement(Component, {
    value: 'mysql',
    options: ['mysql', 'postgresql', 'sqlite', 'sqlserver'],
    onChange: () => { },
    testId: 'select',
    ...props,
  });
}

describe('custom dropdown', () => {
  it('renders the trigger closed with the current value', () => {
    render(Dropdown());
    const trigger = screen.getByTestId('select');
    expect(trigger.textContent).toContain('mysql');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('select-listbox')).toBeNull();
  });

  it('opens on click, renders items, selects one and fires onChange with ✓ on the selected item', () => {
    const onChange = vi.fn();
    render(Dropdown({ onChange }));
    const trigger = screen.getByTestId('select');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByTestId('select-listbox');
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(screen.getByTestId('select-option-sqlite').textContent).toContain('sqlite');
    // The selected item carries the ✓ marker.
    expect(screen.getByTestId('select-option-mysql').textContent).toContain('✓');
    fireEvent.click(screen.getByTestId('select-option-sqlite'));
    expect(onChange).toHaveBeenCalledWith('sqlite');
    expect(onChange).toHaveBeenCalledTimes(1);
    // Closed again after picking.
    expect(screen.queryByTestId('select-listbox')).toBeNull();
  });

  it('closes on Escape and on outside click', () => {
    render(Dropdown());
    fireEvent.click(screen.getByTestId('select'));
    expect(screen.getByTestId('select-listbox')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('select-listbox')).toBeNull();
    fireEvent.click(screen.getByTestId('select'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('select-listbox')).toBeNull();
  });

  it('keyboard: Enter opens, ArrowDown moves, Enter selects', () => {
    const onChange = vi.fn();
    render(Dropdown({ onChange, value: 'mysql' }));
    const trigger = screen.getByTestId('select');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByTestId('select-listbox')).toBeTruthy();
    // mysql → arrow down twice → sqlite, Enter selects it.
    const popover = screen.getByTestId('select-listbox');
    fireEvent.keyDown(popover, { key: 'ArrowDown' });
    fireEvent.keyDown(popover, { key: 'ArrowDown' });
    fireEvent.keyDown(popover, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('sqlite');
    expect(screen.queryByTestId('select-listbox')).toBeNull();
  });

  it('opening one dropdown closes the other (single popover at a time)', () => {
    render(Dropdown({ testId: 'a' }));
    render(Dropdown({ testId: 'b' }));
    fireEvent.click(screen.getByTestId('a'));
    expect(screen.getByTestId('a-listbox')).toBeTruthy();
    fireEvent.click(screen.getByTestId('b'));
    expect(screen.queryByTestId('a-listbox')).toBeNull();
    expect(screen.getByTestId('b-listbox')).toBeTruthy();
  });

  it('custom timezones keep the stored value as the first option', () => {
    const onChange = vi.fn();
    render(Dropdown({ value: '+07:30', options: ['+07:30', '+08:00', '+00:00'], onChange }));
    fireEvent.click(screen.getByTestId('select'));
    const items = ['+07:30', '+08:00', '+00:00'].map((v) => screen.getByTestId(`select-option-${v}`));
    expect(items[0].textContent).toContain('+07:30');
    expect(items[0].textContent).toContain('✓'); // the selected (stored) value is marked
    fireEvent.click(items[1]);
    expect(onChange).toHaveBeenCalledWith('+08:00');
  });
});
