"use client";
import { cn } from "@/lib/utils";
import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useDropzone } from "react-dropzone";
import { Upload, X } from "lucide-react";

const mainVariant = {
  initial: {
    x: 0,
    y: 0,
  },
  animate: {
    x: 20,
    y: -20,
    opacity: 0.9,
  },
};

const secondaryVariant = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
};

export const FileUpload = ({
  onChange,
}: {
  onChange?: (files: File[]) => void;
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (newFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    onChange && onChange(newFiles);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    onDrop: handleFileChange,
    onDropRejected: (error) => {
      console.log(error);
    },
  });

  const imagePreview = useMemo(() => {
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      return URL.createObjectURL(files[0]);
    }
    return null;
  }, [files]);

  const handleRemoveFile = () => {
    setFiles([]);
  };

  return (
    <div className="flex-1 noscrollbar" {...getRootProps()}>
      <motion.div
        onClick={handleClick}
        whileHover="animate"
        className="group/file relative block w-full cursor-pointer overflow-hidden rounded-lg p-4 noscrollbar"
      >
        <input
          ref={fileInputRef}
          id="file-upload-handle"
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
          className="hidden"
          multiple={false}
        />
        <div className="absolute inset-0 mask-[radial-gradient(ellipse_at_center,white,transparent)]">
          <GridPattern />
        </div>
        <div className="flex flex-col items-center justify-center">
          {
            files.length === 0 && !imagePreview && (<>
              <p className="relative z-20 font-sans text-base font-bold text-neutral-700 dark:text-neutral-300">
                Upload file
              </p>
              <p className="relative z-20 mt-2 font-sans text-base font-normal text-neutral-400 dark:text-neutral-400">
                Drag or drop your files here or click to upload
              </p>
            </>
            )}
          <div className="relative mx-auto mt-10 w-full max-w-xl">
            {files.length > 0 && imagePreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-2xl mx-auto"
              >
                <div className="relative rounded-xl overflow-hidden border border-neutral-200 shadow-lg">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-auto max-h-62.5 sm:max-h-100 object-contain bg-neutral-50"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                    title="Remove image"
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 sm:mt-3 px-1 gap-2">
                  <p className="text-xs sm:text-sm text-neutral-600 truncate">
                    {files[0].name}
                  </p>
                  <p className="text-xs sm:text-sm text-neutral-400 shrink-0">
                    {(files[0].size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </motion.div>
            )}
            {!files.length && (
              <motion.div
                layoutId="file-upload"
                variants={mainVariant}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
                className={cn(
                  "relative z-40 mx-auto mt-4 flex h-32 w-full max-w-32 items-center justify-center rounded-md bg-white group-hover/file:shadow-2xl dark:bg-neutral-900",
                  "shadow-[0px_10px_50px_rgba(0,0,0,0.1)]",
                )}
              >
                {isDragActive ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-neutral-600"
                  >
                    Drop it
                    <Upload className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                  </motion.p>
                ) : (
                  <Upload className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                )}
              </motion.div>
            )}

            {!files.length && (
              <motion.div
                variants={secondaryVariant}
                className="absolute inset-0 z-30 mx-auto mt-4 flex h-32 w-full max-w-32 items-center justify-center rounded-md border border-dashed border-sky-400 bg-transparent opacity-0"
              ></motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export function GridPattern() {
  const columns = 41;
  const rows = 11;
  return (
    <div className="flex*1 flex shrink-0 scale-105 flex-wrap items-center justify-center gap-x-px gap-y-px bg-gray-100 dark:bg-neutral-900">
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => {
          const index = row * columns + col;
          return (
            <div
              key={`${col}-${row}`}
              className={`flex h-10 w-10 shrink-0 rounded-[2px] ${index % 2 === 0
                ? "bg-gray-50 dark:bg-neutral-950/20"
                : "bg-gray-50 shadow-[0px_0px_1px_3px_rgba(255,255,255,1)_inset] dark:bg-neutral-950 dark:shadow-[0px_0px_1px_3px_rgba(0,0,0,0.5)_inset]"
                }`}
            />
          );
        }),
      )}
    </div>
  );
}
