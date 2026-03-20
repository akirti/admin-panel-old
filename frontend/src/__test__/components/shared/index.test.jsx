import {
  Button,
  Input,
  Select,
  Card,
  Badge,
  Modal,
  Table,
  Toggle,
  StatCard,
  SearchInput,
  Pagination,
  FileUpload,
  ExportButton,
} from '../../../components/shared/index';

describe('shared/index re-exports', () => {
  it('exports Button component', () => {
    expect(Button).toBeDefined();
    expect(typeof Button).toBe('function');
  });

  it('exports Input component', () => {
    expect(Input).toBeDefined();
    expect(typeof Input).toBe('function');
  });

  it('exports Select component', () => {
    expect(Select).toBeDefined();
    expect(typeof Select).toBe('function');
  });

  it('exports Card component', () => {
    expect(Card).toBeDefined();
    expect(typeof Card).toBe('function');
  });

  it('exports Badge component', () => {
    expect(Badge).toBeDefined();
    // Badge is wrapped with React.memo, so it's an object
    expect(typeof Badge === 'function' || typeof Badge === 'object').toBe(true);
  });

  it('exports Modal component', () => {
    expect(Modal).toBeDefined();
    expect(typeof Modal).toBe('function');
  });

  it('exports Table component', () => {
    expect(Table).toBeDefined();
    expect(typeof Table).toBe('function');
  });

  it('exports Toggle component', () => {
    expect(Toggle).toBeDefined();
    expect(typeof Toggle).toBe('function');
  });

  it('exports StatCard component', () => {
    expect(StatCard).toBeDefined();
    // StatCard is wrapped with React.memo, so it's an object
    expect(typeof StatCard === 'function' || typeof StatCard === 'object').toBe(true);
  });

  it('exports SearchInput component', () => {
    expect(SearchInput).toBeDefined();
    // SearchInput is wrapped with React.memo, so it's an object
    expect(typeof SearchInput === 'function' || typeof SearchInput === 'object').toBe(true);
  });

  it('exports Pagination component', () => {
    expect(Pagination).toBeDefined();
    expect(typeof Pagination).toBe('function');
  });

  it('exports FileUpload component', () => {
    expect(FileUpload).toBeDefined();
    expect(typeof FileUpload).toBe('function');
  });

  it('exports ExportButton component', () => {
    expect(ExportButton).toBeDefined();
  });
});
