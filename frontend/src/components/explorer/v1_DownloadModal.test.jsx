import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1DownloadModal from './v1_DownloadModal';

describe('V1DownloadModal', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <V1DownloadModal isOpen={false} onClose={vi.fn()} onDownload={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal with title when open', () => {
    render(<V1DownloadModal isOpen={true} onClose={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText('Download Data')).toBeInTheDocument();
  });

  it('shows data range options', () => {
    render(<V1DownloadModal isOpen={true} onClose={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText('Current Page')).toBeInTheDocument();
    expect(screen.getByText('Full Report')).toBeInTheDocument();
  });

  it('shows format options', () => {
    render(<V1DownloadModal isOpen={true} onClose={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('defaults to current page and CSV', () => {
    render(<V1DownloadModal isOpen={true} onClose={vi.fn()} onDownload={vi.fn()} />);
    const currentRadio = screen.getByDisplayValue('current');
    const csvRadio = screen.getByDisplayValue('csv');
    expect(currentRadio).toBeChecked();
    expect(csvRadio).toBeChecked();
  });

  it('allows changing download type', async () => {
    const user = userEvent.setup();
    render(<V1DownloadModal isOpen={true} onClose={vi.fn()} onDownload={vi.fn()} />);

    await user.click(screen.getByText('Full Report'));
    expect(screen.getByDisplayValue('full')).toBeChecked();
  });

  it('allows changing format', async () => {
    const user = userEvent.setup();
    render(<V1DownloadModal isOpen={true} onClose={vi.fn()} onDownload={vi.fn()} />);

    await user.click(screen.getByText('JSON'));
    expect(screen.getByDisplayValue('json')).toBeChecked();
  });

  it('calls onDownload with selected options', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const onClose = vi.fn();
    render(<V1DownloadModal isOpen={true} onClose={onClose} onDownload={onDownload} />);

    await user.click(screen.getByText('Full Report'));
    await user.click(screen.getByText('JSON'));
    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(onDownload).toHaveBeenCalledWith({ type: 'full', format: 'json' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<V1DownloadModal isOpen={true} onClose={onClose} onDownload={vi.fn()} />);

    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<V1DownloadModal isOpen={true} onClose={onClose} onDownload={vi.fn()} />);

    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <V1DownloadModal isOpen={true} onClose={onClose} onDownload={vi.fn()} />
    );

    const backdrop = container.querySelector('.bg-black\\/40');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
