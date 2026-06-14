'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const groupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
});

type GroupFormData = z.infer<typeof groupSchema>;

type GroupFormProps = {
  defaultValues?: { name: string; description: string };
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  isLoading: boolean;
};

export function GroupForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
}: GroupFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      description: defaultValues?.description || '',
    },
  });

  const submitForm = async (data: GroupFormData) => {
    await onSubmit({
      name: data.name.trim(),
      description: data.description?.trim() ?? '',
    });
  };

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
      <div>
        <Input
          id="name"
          label="Group Name"
          type="text"
          {...register('name')}
          error={errors.name?.message}
          disabled={isLoading}
          placeholder="e.g. The Flat"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium text-gray-300">
          Description (Optional)
        </label>
        <textarea
          id="description"
          {...register('description')}
          disabled={isLoading}
          rows={3}
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          placeholder="What is this group for?"
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
