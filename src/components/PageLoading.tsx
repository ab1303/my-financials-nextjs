import Loading from './Loading';

type LoadingProps = {
  loadingText?: string;
};

const PageLoading = ({ loadingText }: LoadingProps) => {
  return (
    <div className='flex items-center justify-center h-screen shadow-lg shadow-orange-500 border-2'>
      <Loading loadingText={loadingText} />
    </div>
  );
};

export default PageLoading;
