import { describe, expect, it } from 'vitest';
import { parseQueryIntent } from './queryIntent';

describe('parseQueryIntent', () => {
  it('parses color, fit, category and a comma-formatted rupee price ceiling', () => {
    expect(parseQueryIntent('Black oversized T-shirt under ₹1,000')).toEqual({
      color: 'black',
      fit: 'oversized',
      category: 't-shirt',
      maxPrice: 1000,
    });
  });

  it('parses a plain-number price ceiling without a currency symbol', () => {
    expect(parseQueryIntent('slim jeans under 2500')).toEqual({
      fit: 'slim',
      category: 'jeans',
      maxPrice: 2500,
    });
  });

  it('omits fields it cannot confidently parse rather than guessing', () => {
    expect(parseQueryIntent('Something similar to this, but cheaper')).toEqual({});
    expect(parseQueryIntent('Casual shirts for a summer trip')).toEqual({ category: 'shirt' });
  });
});
