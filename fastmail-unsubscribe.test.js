import { describe, test, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Tampermonkey API before importing the script
global.GM_addStyle = vi.fn();

// Now import the functions
const { parseUnsubscribeLinks, decodeQuotedPrintable } = await import('./fastmail-unsubscribe.js');

describe('Fastmail Unsubscribe Header Tests', () => {
  describe('decodeQuotedPrintable', () => {
    const testCases = [
      {
        name: 'handles complex encoded header with split parts',
        input: '=?us-ascii?Q?=3Chttps=3A=2F=2F03=2Eemailinboundprocessing=2Ecom=2Fenc=5Fuser=2Flist=5Funsubscri?= =?us-ascii?Q?be=3Fd=3D%241%24kYdlZ%2FMtZKhQo1fCiaeJUA%3D=3E?=',
        expected: '<https://03.emailinboundprocessing.com/enc_user/list_unsubscribe?d=%241%24kYdlZ%2FMtZKhQo1fCiaeJUA%3D>'
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
        expect(decodeQuotedPrintable(input)).toBe(expected);
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

    describe('complex URL parameter handling', () => {
      test('preserves complex encoded d parameter', () => {
        const header = '=?utf-8?Q?=3Chttps=3A=2F=2Fexample=2Ecom=2Funsubscribe=3Fd=3D=241=24Rk9x=2BJ%2FMt5Kh=2B?= =?utf-8?Q?Qo1fC%2FaeJ%252BUA=253D=3E?=';
        createTestDOM(header);

        const result = parseUnsubscribeLinks();
        expect(result.links).toEqual([
          { type: 'http', url: 'https://example.com/unsubscribe?d=$1$Rk9x+J%2FMt5Kh+Qo1fC%2FaeJ%252BUA%3D' }
        ]);
      });

      test('handles URL-encoded special characters in d parameter', () => {
        const header = '=?utf-8?Q?=3Chttps=3A=2F=2Fexample=2Ecom=2Funsubscribe=3Fd=3DaHR0cHM6Ly9l?= =?utf-8?Q?eGFtcGxlLmNvbS91bnN1YnNjcmliZT9pZD0xMjM=253D=3E?=';
        createTestDOM(header);

        const result = parseUnsubscribeLinks();
        expect(result.links).toEqual([
          { type: 'http', url: 'https://example.com/unsubscribe?d=aHR0cHM6Ly9leGFtcGxlLmNvbS91bnN1YnNjcmliZT9pZD0xMjM%3D' }
        ]);
      });

      test('handles multiline encoded d parameter', () => {
        const header = '=?utf-8?Q?=3Chttps=3A=2F=2Fexample=2Ecom=2Funsubscribe=3Fd=3D?= =?utf-8?Q?VGhpc0lzQUxvbmdFbmNvZGVk?= =?utf-8?Q?VmFsdWVXaXRoTXVsdGlwbGVMaW5lcw=3D=3D=3E?=';
        createTestDOM(header);

        const result = parseUnsubscribeLinks();
        expect(result.links).toEqual([
          { type: 'http', url: 'https://example.com/unsubscribe?d=VGhpc0lzQUxvbmdFbmNvZGVkVmFsdWVXaXRoTXVsdGlwbGVMaW5lcw==' }
        ]);
      });
    });
  });

  describe('Test Quoted Printable', () => {
    test('Specific instance', () => {
      const input = `=?us-ascii?Q?=3Chttps=3A=2F=2Ftest=2Eexample=2Ecom=2Fapi=2Fuser=2Flist=5Funsubscri?=`
        + `=?us-ascii?Q?be=3Fd=3D%24TEST%24FakeHashData123%2BAbcDef%3D%3D?=`
        + `=?us-ascii?Q?%3D%24MockToken456%2BMoreFakeData%2FExample%2FHere?=`
        + `=?us-ascii?Q?SampleEncodedContent%2BTestData%3D%3D%0ANext?=`
        + `=?us-ascii?Q?LineOfFakeContent%2BMoreTest%2FData%2FValues%0A?=`
        + `=?us-ascii?Q?FinalPartOfTestData%2BEndContent%3D%3D&test=3D1=3E=2C=3Cmailto?=`
        + `=?us-ascii?Q?=3Atest=5Femail=40example=2Ecom=3Fsubject=3DTest?=`
        + `=?us-ascii?Q?%20Subject&body=3DTEST=5FCONTENT=3E?=`;

    const expected = '<https://test.example.com/api/user/list_unsubscribe?d=%24TEST%24FakeHashData123%2BAbcDef%3D%3D%3D%24MockToken456%2BMoreFakeData%2FExample%2FHereSampleEncodedContent%2BTestData%3D%3D%0ANextLineOfFakeContent%2BMoreTest%2FData%2FValues%0AFinalPartOfTestData%2BEndContent%3D%3D&test=1>,<mailto:test_email@example.com?subject=Test%20Subject&body=TEST_CONTENT>';
      expect(decodeQuotedPrintable(input)).toBe(expected);
    });
  });
});
