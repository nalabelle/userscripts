import { describe, test, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Tampermonkey API before importing the script
global.GM_addStyle = vi.fn();

// Now import the functions
const { decodeEncodedWord, parseUnsubscribeLinks } = await import('./fastmail-unsubscribe.js');

describe('Fastmail Unsubscribe Header Tests', () => {
  describe('decodeEncodedWord', () => {
    const testCases = [
      {
        name: 'handles complex encoded header with split parts',
        input: '=?us-ascii?Q?=3Chttps=3A=2F=2F03=2Eemailinboundprocessing=2Ecom=2Fenc=5Fuser=2Flist=5Funsubscri?= =?us-ascii?Q?be=3Fd=3D%241%24kYdlZ%2FMtZKhQo1fCiaeJUA%3D=3E?=',
        expected: '<https://03.emailinboundprocessing.com/enc_user/list_unsubscribe?d=$1$kYdlZ/MtZKhQo1fCiaeJUA=>'
      },
      {
        name: 'handles multiple URLs in encoded header',
        input: '=?utf-8?Q?=3Cmailto=3Aunsubscribe=40example=2Ecom=3E=2C_=3Chttps=3A=2F=2Fexample=2Ecom=2Funsubscribe=3E?=',
        expected: '<mailto:unsubscribe@example.com>, <https://example.com/unsubscribe>'
      },
      {
        name: 'preserves URL-safe characters',
        input: '=?utf-8?Q?=3Chttps=3A=2F=2Fexample=2Ecom=2Funsubscribe=3Fid=3D123=26token=3Dabc=3E?=',
        expected: '<https://example.com/unsubscribe?id=123&token=abc>'
      },
      {
        name: 'handles special characters in mailto links',
        input: '=?utf-8?Q?=3Cmailto=3Aunsubscribe=2B123=40example=2Ecom=3Fsubject=3DUnsubscribe=3E?=',
        expected: '<mailto:unsubscribe+123@example.com?subject=Unsubscribe>'
      }
    ];

    testCases.forEach(({ name, input, expected }) => {
      test(name, () => {
        expect(decodeEncodedWord(input)).toBe(expected);
      });
    });

    describe('error handling', () => {
      test('handles malformed encoded words', () => {
        const malformed = '=?utf-8?Q?incomplete encoded word';
        expect(decodeEncodedWord(malformed)).toBe(malformed);
      });

      test('handles invalid hex codes', () => {
        const invalid = '=?utf-8?Q?=XX?=';
        expect(decodeEncodedWord(invalid)).toBe('=XX');
      });

      test('handles empty encoded words', () => {
        const empty = '=?utf-8?Q??=';
        expect(decodeEncodedWord(empty)).toBe('');
      });
    });
  });

  describe('parseUnsubscribeLinks', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    const createTestDOM = (headerText) => {
      document.body.innerHTML = `
        <div class="v-Message-details">
          <div class="v-Message-detailsTitle">List-Unsubscribe:</div>
          <div>${headerText}</div>
        </div>
      `;
    };

    test('extracts both http and mailto links from encoded header', () => {
      const header = '=?utf-8?Q?=3Chttps=3A=2F=2Fexample=2Ecom=2Funsubscribe=3E=2C_=3Cmailto=3Aunsubscribe=40example=2Ecom=3E?=';
      createTestDOM(header);

      const result = parseUnsubscribeLinks();
      expect(result.links).toEqual([
        { type: 'http', url: 'https://example.com/unsubscribe' },
        { type: 'email', url: 'mailto:unsubscribe@example.com' }
      ]);
    });

    test('handles complex split encoded header', () => {
      const header = '=?us-ascii?Q?=3Chttps=3A=2F=2F03=2Eemailinboundprocessing=2Ecom=2Fenc=5Fuser=2F?= =?us-ascii?Q?list=5Funsubscribe=3Fd=3D123=3E?=';
      createTestDOM(header);

      const result = parseUnsubscribeLinks();
      expect(result.links).toEqual([
        { type: 'http', url: 'https://03.emailinboundprocessing.com/enc_user/list_unsubscribe?d=123' }
      ]);
    });

    test('extracts bare URLs when no angle brackets present', () => {
      const header = '=?utf-8?Q?https=3A=2F=2Fexample=2Ecom=2Funsubscribe=2C_mailto=3Aunsubscribe=40example=2Ecom?=';
      createTestDOM(header);

      const result = parseUnsubscribeLinks();
      expect(result.links).toEqual([
        { type: 'http', url: 'https://example.com/unsubscribe' },
        { type: 'email', url: 'mailto:unsubscribe@example.com' }
      ]);
    });

    describe('error handling', () => {
      test('handles missing List-Unsubscribe header', () => {
        document.body.innerHTML = '<div class="v-Message-details"></div>';
        expect(parseUnsubscribeLinks()).toBeNull();
      });

      test('handles empty header value', () => {
        createTestDOM('');
        expect(parseUnsubscribeLinks().links).toEqual([]);
      });

      test('handles malformed URLs', () => {
        createTestDOM('<not-a-valid-url>, <mailto:invalid@');
        const result = parseUnsubscribeLinks();
        expect(result.links).toEqual([]);
      });
    });
  });
});
