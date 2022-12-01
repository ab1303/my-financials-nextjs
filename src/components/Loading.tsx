type LoadingProps = {
  loadingText?: string;
};

const Loading = ({ loadingText }: LoadingProps) => {
  return (
    <div className='flex items-center justify-center space-x-2'>
      <div
        className='spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-orange-600'
        role='status'
      >
        <span className='visually-hidden '>
          {!loadingText ? loadingText : 'Loading...'}
        </span>
      </div>
    </div>
  );
};

export default Loading;
