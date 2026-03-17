import { renderHook, act } from '@testing-library/react';
import usePlayboardUpload from '../../hooks/usePlayboardUpload';
import toast from 'react-hot-toast';

jest.mock('../../services/api', () => ({
  playboardsAPI: {
    upload: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  error: jest.fn(),
  success: jest.fn(),
}));

import { playboardsAPI } from '../../services/api';

const SCENARIO_KEY = 'test-scenario';
const MOCK_FETCH = jest.fn();

describe('usePlayboardUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
    expect(result.current.uploadModalOpen).toBe(false);
    expect(result.current.uploadFile).toBeNull();
    expect(result.current.uploadName).toBe('');
    expect(result.current.uploadDescription).toBe('');
    expect(result.current.jsonPreview).toBeNull();
  });

  it('toggles modal open state', () => {
    const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
    act(() => result.current.setUploadModalOpen(true));
    expect(result.current.uploadModalOpen).toBe(true);
  });

  it('resets upload form fields', () => {
    const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
    act(() => {
      result.current.setUploadName('test-name');
      result.current.setUploadDescription('test-desc');
    });
    expect(result.current.uploadName).toBe('test-name');

    act(() => result.current.resetUploadForm());
    expect(result.current.uploadFile).toBeNull();
    expect(result.current.uploadName).toBe('');
    expect(result.current.uploadDescription).toBe('');
    expect(result.current.jsonPreview).toBeNull();
  });

  describe('handleFileSelect', () => {
    function makeJsonFile(content, name = 'test.json') {
      const file = new File([content], name, { type: 'application/json' });
      file.text = () => Promise.resolve(content);
      return file;
    }

    it('parses JSON file and sets preview and name from key', async () => {
      const jsonContent = JSON.stringify({ key: 'my-playboard', data: [1, 2] });
      const file = makeJsonFile(jsonContent);

      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(file));

      expect(result.current.uploadFile).toBe(file);
      expect(result.current.jsonPreview).toEqual({ key: 'my-playboard', data: [1, 2] });
      expect(result.current.uploadName).toBe('my-playboard');
    });

    it('handles JSON file without key field', async () => {
      const jsonContent = JSON.stringify({ data: 'no key' });
      const file = makeJsonFile(jsonContent, 'nokey.json');

      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(file));

      expect(result.current.jsonPreview).toEqual({ data: 'no key' });
      expect(result.current.uploadName).toBe('');
    });

    it('shows error toast for invalid JSON', async () => {
      const file = makeJsonFile('not json', 'bad.json');

      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(file));

      expect(toast.error).toHaveBeenCalledWith('Invalid JSON file');
      expect(result.current.jsonPreview).toBeNull();
    });

    it('skips JSON parsing for non-json files', async () => {
      const file = new File(['data'], 'data.csv', { type: 'text/csv' });

      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(file));

      expect(result.current.uploadFile).toBe(file);
      expect(result.current.jsonPreview).toBeNull();
    });

    it('handles null file', async () => {
      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(null));
      expect(result.current.uploadFile).toBeNull();
    });
  });

  describe('handleFileUpload', () => {
    const mockEvent = { preventDefault: jest.fn() };

    it('shows error when no file selected', async () => {
      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileUpload(mockEvent));

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Please select a file');
      expect(playboardsAPI.upload).not.toHaveBeenCalled();
    });

    it('uploads file successfully and resets form', async () => {
      playboardsAPI.upload.mockResolvedValue({});
      const file = new File(['data'], 'test.json', { type: 'application/json' });

      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(file));
      act(() => {
        result.current.setUploadName('my-board');
        result.current.setUploadDescription('desc');
        result.current.setUploadModalOpen(true);
      });

      await act(async () => result.current.handleFileUpload(mockEvent));

      expect(playboardsAPI.upload).toHaveBeenCalledWith(
        expect.any(FormData),
        { scenario_key: SCENARIO_KEY, name: 'my-board', description: 'desc' }
      );
      expect(toast.success).toHaveBeenCalledWith('Playboard uploaded successfully');
      expect(result.current.uploadModalOpen).toBe(false);
      expect(result.current.uploadFile).toBeNull();
      expect(MOCK_FETCH).toHaveBeenCalled();
    });

    it('sends undefined for empty name/description', async () => {
      playboardsAPI.upload.mockResolvedValue({});
      const file = new File(['data'], 'test.csv');

      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(file));
      await act(async () => result.current.handleFileUpload(mockEvent));

      const callArgs = playboardsAPI.upload.mock.calls[0][1];
      expect(callArgs.name).toBeUndefined();
      expect(callArgs.description).toBeUndefined();
    });

    it('shows error toast on upload failure', async () => {
      playboardsAPI.upload.mockRejectedValue({
        response: { data: { detail: 'File too large' } },
      });
      const file = new File(['data'], 'test.csv');

      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(file));
      await act(async () => result.current.handleFileUpload(mockEvent));

      expect(toast.error).toHaveBeenCalledWith('File too large');
    });

    it('shows fallback error message when no detail', async () => {
      playboardsAPI.upload.mockRejectedValue(new Error('network'));
      const file = new File(['data'], 'test.csv');

      const { result } = renderHook(() => usePlayboardUpload(SCENARIO_KEY, MOCK_FETCH));
      await act(async () => result.current.handleFileSelect(file));
      await act(async () => result.current.handleFileUpload(mockEvent));

      expect(toast.error).toHaveBeenCalledWith('Upload failed');
    });
  });
});
